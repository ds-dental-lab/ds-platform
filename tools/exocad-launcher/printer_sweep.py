# -*- coding: utf-8 -*-
"""
프린터 **주소 훑기** — 방송(SSDP)을 못 들을 때 같은 망을 훑어 시리얼로 찾습니다 (2026-10-21).

★ 왜 — 전 현장 경험(사용자): 공유기가 여러 대인 치과는 프린터를 껐다 켜면 다른 공유기에
  붙어 주소가 바뀌고, 윈도우 방화벽이 방송을 막는 PC 도 많았습니다. 그때마다 사람이 가서
  고쳤습니다. 방송이 안 들려도 **PC 와 같은 대역 안에 있기만 하면** 여기서 찾습니다.
★ 어떻게 — PC 의 IPv4 대역(/24 로 봄)을 8883 포트로 빠르게 두드려 후보를 모으고,
  후보마다 프린터 통로(MQTT)에 접속 코드로 붙어 **그 시리얼의 보고가 오는지** 봅니다.
  코드는 프린터마다 달라서 다른 프린터에는 못 붙고, 보고 토픽은 시리얼이라 같은 코드의
  다른 기계도 걸러집니다.
★ 지난번 주소(preferred)를 먼저 봅니다 — 대개 거기 그대로 있어서 훑기까지 안 갑니다.
★ 한 대역 254개를 0.4초 제한·64줄로 두드리면 2초 안쪽입니다. 대역이 둘이면 둘 다.
★ 찾은 것은 프린터찾기.txt 에 남깁니다 (printer_find 와 같은 파일).
"""
from __future__ import annotations

import socket
import ssl
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

PORT = 8883


def local_prefixes(addresses: list[str] | None = None) -> list[str]:
    """
    이 PC 의 IPv4 대역들 — '192.168.0.' 꼴. /24 로 봅니다 (치과 망은 거의 그렇습니다).
    ★ 127.· 169.254.(주소 못 받은 어댑터)는 뺍니다.
    """
    ips: set[str] = set(addresses or [])
    if addresses is None:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))  # 보내지 않습니다 — 나가는 어댑터의 주소만 묻습니다
            ips.add(s.getsockname()[0])
            s.close()
        except OSError:
            pass
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                ips.add(info[4][0])
        except OSError:
            pass
    out: set[str] = set()
    for ip in ips:
        if ip.startswith(("127.", "169.254.")) or ip.count(".") != 3:
            continue
        out.add(ip.rsplit(".", 1)[0] + ".")
    return sorted(out)


def port_open(host: str, port: int = PORT, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def hosts_with_port(prefix: str, port: int = PORT, timeout: float = 0.4, workers: int = 64) -> list[str]:
    """대역 안에서 그 포트가 열린 주소들. 순서는 주소 순"""
    hosts = [f"{prefix}{n}" for n in range(1, 255)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        hits = list(pool.map(lambda h: h if port_open(h, port, timeout) else None, hosts))
    return [h for h in hits if h]


def is_my_printer(host: str, serial: str, access_code: str, seconds: float = 4.0) -> bool:
    """
    이 주소가 **그 시리얼의, 그 코드의** 프린터인가.
    접속 코드로 붙고 보고 토픽(시리얼)에서 한 번이라도 소식이 오면 맞습니다.
    """
    try:
        import paho.mqtt.client as mqtt  # noqa: PLC0415
    except ImportError:
        return port_open(host)  # 라이브러리가 없으면 포트만으로 봅니다 (시험 환경)

    heard = threading.Event()
    refused = threading.Event()

    def on_connect(c, _u, _f, rc, *_rest) -> None:
        if rc != 0:
            refused.set()
            return
        c.subscribe(f"device/{serial}/report")
        c.publish(f"device/{serial}/request", '{"pushing":{"sequence_id":"1","command":"pushall"}}')

    def on_message(_c, _u, _m) -> None:
        heard.set()

    client = mqtt.Client()
    client.username_pw_set("bblp", access_code)
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)
    client.on_connect = on_connect
    client.on_message = on_message
    try:
        client.connect(host, PORT, keepalive=10)
    except OSError:
        return False
    client.loop_start()
    try:
        until = time.time() + seconds
        while time.time() < until and not heard.is_set() and not refused.is_set():
            time.sleep(0.1)
    finally:
        client.loop_stop()
        try:
            client.disconnect()
        except OSError:
            pass
    return heard.is_set()


def sweep(
    serial: str,
    access_code: str,
    preferred: str = "",
    prefixes: list[str] | None = None,
    probe: Callable[[str], list[str]] = hosts_with_port,
    verify: Callable[[str, str, str], bool] = is_my_printer,
    say: Callable[[str], None] | None = None,
) -> str | None:
    """
    프린터 주소. 지난번 주소 → 대역 훑기. 못 찾으면 None.
    ★ probe/verify 는 시험에서 바꿔 끼웁니다.
    """
    tell = say or (lambda _m: None)
    if not serial or not access_code:
        return None
    if preferred and verify(preferred, serial, access_code):
        tell(f"지난번 주소 {preferred} 에 그대로 있습니다")
        return preferred
    nets = prefixes if prefixes is not None else local_prefixes()
    tried: list[str] = []
    for prefix in nets:
        candidates = [h for h in probe(prefix) if h != preferred]
        tried += candidates
        for host in candidates:
            if verify(host, serial, access_code):
                tell(f"망을 훑어 {host} 에서 찾았습니다 (대역 {prefix}0/24)")
                _note(serial, host, nets, tried)
                return host
    tell(f"훑었지만 없습니다 — 대역 {', '.join(p + '0/24' for p in nets) or '없음'}, 8883 열린 주소 {len(tried)}개")
    _note(serial, None, nets, tried)
    return None


def _note(serial: str, host: str | None, nets: list[str], tried: list[str]) -> None:
    try:
        from printer_find import LOG  # noqa: PLC0415

        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(
                f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] 주소 훑기 — 대역 {nets} · 8883 후보 {tried} · "
                + (f"찾음 {host}\n" if host else "못 찾음\n")
            )
    except OSError:
        pass
