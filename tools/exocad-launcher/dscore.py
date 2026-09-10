# -*- coding: utf-8 -*-
"""
DS Core(r9.dscore.com) 에 dxd 를 올려 exocad 용 ply 로 받아 오는 자동화. (2026-09-10)

옛 dxd-conversion.exe 가 하던 일을 **오늘 화면 기준**으로 다시 썼습니다 (exe 는 소스가
없고 DS Core 화면이 바뀌어 멈췄음). 화면 이름은 2026-09-10 에 직접 읽은 것:

  환자 목록  #/patients : 검색(aria '환자 검색'), 버튼 '신규 환자'
  환자 추가 창          : input aria '이름' '성' '생년월일…' '카드 ID / 환자ID', 버튼 '환자 추가'
  환자 화면  #/patients/<uuid> : 버튼 '미디어 업로드' → 패널(드롭존 [id^=dropzone-container-],
                              버튼 '파일 업로드 (n)', '닫기')
  파일 카드 ⋮ 메뉴      : '다른 이름으로 다운로드' ▸ '.dxd' '.stl' '.ply' '.exocad'
  환자 줄 ⋮ 메뉴        : '수정' '삭제' → 확인창(체크 '데이터를 다른 곳에 저장했습니다.', 버튼 '삭제')
  내보내기 결과         : zipper.r9.dscore.com/api/zip?… → <날짜>-00000-000-upperjaw.ply,
                          -upperjaw-gingiva.ply, -lowerjaw.ply (+ 빈 .dentalproject)

★ Flutter 웹이라 접근성 트리를 켜야(flt-semantics-placeholder 클릭) 요소가 보입니다.
★ 로그인은 런처 전용 Chrome 프로필(chrome-profile/)에 남습니다 — 매번 안 합니다.
★ 임시 환자는 "Demo, Case<숫자>" / 카드 ID "TMP-<숫자>" — 덴플로우와 엮이는 이름은 안 씀 (사용자 지시). 끝나면 지웁니다.
★ 실패하면 logs/ 에 그 순간 화면(png)을 남깁니다.

사용:  python dscore.py <dxd 경로> <케이스 폴더> [--show]
"""
from __future__ import annotations

import base64
import json
import logging
import re
import shutil
import sys
import tempfile
import time
import zipfile
from pathlib import Path

from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

HERE = Path(__file__).resolve().parent
PROFILE = HERE / "chrome-profile"
LOG_DIR = HERE / "logs"
BASE = "https://r9.dscore.com"
log = logging.getLogger("dscore")


SETTINGS = HERE / "settings.json"


def has_settings() -> bool:
    return SETTINGS.is_file()


def save_settings(email: str, password: str) -> None:
    SETTINGS.write_text(json.dumps({"email": email, "password": password, "headless": True}, ensure_ascii=False, indent=2), encoding="utf-8")


def _settings() -> dict:
    if SETTINGS.is_file():
        return json.loads(SETTINGS.read_text(encoding="utf-8"))
    raise RuntimeError("DS Core 계정 파일(settings.json)이 없습니다")


class DSCore:
    def __init__(self, download_dir: Path, show: bool = False, say=None) -> None:
        self.download_dir = download_dir
        self.say = say or (lambda m: None)
        opts = Options()
        opts.add_argument(f"--user-data-dir={PROFILE}")
        opts.add_argument("--window-size=1400,1000")
        opts.add_argument("--lang=ko-KR")
        if not show:
            opts.add_argument("--headless=new")
        opts.add_experimental_option("prefs", {
            "download.default_directory": str(download_dir),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
        })
        opts.add_experimental_option("excludeSwitches", ["enable-logging"])
        self.d = webdriver.Chrome(options=opts)
        self.d.execute_cdp_cmd("Page.setDownloadBehavior", {"behavior": "allow", "downloadPath": str(download_dir)})
        self.w = WebDriverWait(self.d, 30)

    # ---------- 도구 ----------

    def _url(self) -> str:
        """로그인 뒤 창이 바뀌는 경우가 있어 모든 창을 봅니다. 없으면 빈 문자열."""
        try:
            for h in self.d.window_handles:
                self.d.switch_to.window(h)
                u = self.d.current_url
                if u:
                    return u
        except Exception:  # noqa: BLE001
            pass
        return ""

    def note(self, msg: str) -> None:
        log.info(msg)
        self.say(msg)

    def shot(self, name: str) -> None:
        try:
            LOG_DIR.mkdir(exist_ok=True)
            self.d.save_screenshot(str(LOG_DIR / f"dscore-{name}-{int(time.time())}.png"))
        except Exception:  # noqa: BLE001
            pass

    def enable_semantics(self) -> None:
        """Flutter 접근성 트리 켜기 — 안 켜면 버튼·입력칸이 DOM 에 없습니다."""
        for _ in range(20):
            if self.d.find_elements(By.CSS_SELECTOR, "flt-semantics"):
                return
            ph = self.d.find_elements(By.CSS_SELECTOR, "flt-semantics-placeholder")
            if ph:
                self.d.execute_script("arguments[0].click(); arguments[0].dispatchEvent(new MouseEvent('click',{bubbles:true}))", ph[0])
            time.sleep(0.5)

    def rect(self, el):
        return self.d.execute_script("const b=arguments[0].getBoundingClientRect();return [b.x,b.y,b.width,b.height]", el)

    def cdp_click(self, el) -> None:
        """★ 접근성 노드에 보내는 클릭은 Flutter 가 '탭' 으로 안 칠 때가 있습니다 (⋮ 메뉴가
           포커스만 잡히고 안 열림, 2026-09-10). 개발자 프로토콜로 화면 좌표에 진짜 마우스
           이벤트를 넣으면 사람이 누른 것과 같습니다."""
        x, y, w, h = self.rect(el)
        x, y = x + w / 2, y + h / 2
        self.d.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x, "y": y})
        self.d.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mousePressed", "x": x, "y": y, "button": "left", "clickCount": 1})
        self.d.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": x, "y": y, "button": "left", "clickCount": 1})

    def cdp_hover(self, el) -> None:
        x, y, w, h = self.rect(el)
        self.d.execute_cdp_cmd("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": x + w / 2, "y": y + h / 2})

    def innermost(self, text: str, timeout: int = 10):
        """글자를 품은 요소 중 **가장 안쪽** — 바깥 상자는 화면 전체 크기라 좌표가 틀립니다."""
        xp = f"//flt-semantics[contains(normalize-space(.), '{text}') and not(.//flt-semantics[contains(normalize-space(.), '{text}')])]"
        return WebDriverWait(self.d, timeout).until(EC.presence_of_element_located((By.XPATH, xp)))

    def button(self, text: str, timeout: int = 30, exact: bool = False):
        cond = f"normalize-space(.)='{text}'" if exact else f"contains(normalize-space(.), '{text}')"
        xp = f"//flt-semantics[(@role='button' or @flt-tappable='') and {cond}]"
        return WebDriverWait(self.d, timeout).until(EC.presence_of_element_located((By.XPATH, xp)))

    def click(self, el) -> None:
        self.d.execute_script("arguments[0].scrollIntoView({block:'center'})", el)
        try:
            el.click()
        except Exception:  # noqa: BLE001
            self.d.execute_script("arguments[0].click()", el)

    def input(self, aria_prefix: str, timeout: int = 20):
        xp = f"//input[starts-with(@aria-label, '{aria_prefix}')]"
        return WebDriverWait(self.d, timeout).until(EC.presence_of_element_located((By.XPATH, xp)))

    def type_into(self, el, text: str) -> None:
        self.click(el)
        el.send_keys(Keys.CONTROL, "a")
        el.send_keys(text)
        time.sleep(0.3)

    # ---------- 로그인 ----------

    def ensure_login(self) -> None:
        """
        ★ 로그인은 login.r9.dscore.com 의 **Flutter** 페이지입니다 (2026-09-10 확인).
          - 앱(#/login)의 '로그인' 버튼 → login.r9.dscore.com/#/login (OAuth, PKCE)
          - 접근성 트리를 켜면 input[aria-label='이메일'], input[aria-label='암호'] 가 생깁니다.
            그 칸을 **클릭해 포커스**한 뒤 실제 키 입력(ActionChains)으로 넣어야 Flutter 가 받습니다.
            DOM 값을 바꾸는 방식(send_keys 만, JS value)은 화면에만 찍히거나 무시됩니다.
          - reCAPTCHA(invisible)가 붙어 있어 사람 같은 입력이 낫습니다.
        """
        from selenium.webdriver.common.action_chains import ActionChains

        self.d.get(BASE + "/#/patients")
        # ★ 이미 로그인된 프로필이면 환자 목록('신규 환자')이 뜹니다. 접근성 트리가 늦게
        #   채워질 때가 있어 15초까지 기다립니다 — 3초만 보고 "로그인 안 됨" 으로 판단했다가
        #   첫 화면 버튼을 찾느라 헛돈 일이 있었습니다 (2026-09-10).
        for _ in range(15):
            time.sleep(1)
            self.enable_semantics()
            if self.d.find_elements(By.XPATH, "//flt-semantics[contains(normalize-space(.), '신규 환자')]"):
                self.note("이미 로그인돼 있음")
                return
            if self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='로그인']") or "login." in (self._url() or ""):
                break
        s = _settings()
        self.note("DS Core 로그인 중")
        for attempt in range(3):
            try:
                # 첫 화면(지역 선택 + 로그인 버튼) → login.r9.dscore.com 으로 넘어가야 합니다.
                # JS 클릭이 안 먹는 때가 있어 실제 마우스 클릭으로도 시도합니다.
                for way in range(4):
                    if "login.r9.dscore.com" in (self._url() or ""):
                        break
                    self.enable_semantics()
                    btn = self.button("로그인", 20, exact=True)
                    if way % 2 == 0:
                        ActionChains(self.d).move_to_element(btn).click().perform()
                    else:
                        self.click(btn)
                    try:
                        WebDriverWait(self.d, 8).until(lambda d: "login.r9.dscore.com" in (self._url() or ""))
                    except TimeoutException:
                        self.shot(f"landing{attempt}{way}")
                WebDriverWait(self.d, 10).until(lambda d: "login.r9.dscore.com" in (self._url() or ""))
                time.sleep(2)
                self.enable_semantics()
                email = WebDriverWait(self.d, 20).until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[aria-label='이메일']")))
                ActionChains(self.d).move_to_element(email).click().perform()
                time.sleep(0.3)
                ActionChains(self.d).send_keys(Keys.CONTROL + "a").send_keys(s["email"]).perform()
                time.sleep(0.5)
                pw = self.d.find_element(By.CSS_SELECTOR, "input[aria-label='암호']")
                ActionChains(self.d).move_to_element(pw).click().perform()
                time.sleep(0.3)
                ActionChains(self.d).send_keys(s["password"]).perform()
                time.sleep(0.5)
                self.click(self.button("로그인", 10, exact=True))
                WebDriverWait(self.d, 40).until(lambda d: any(k in (self._url() or "") for k in ("r9.dscore.com/#/home", "r9.dscore.com/#/patients", "r9.dscore.com/#/dashboard")) and "login." not in (self._url() or ""))
                self.d.get(BASE + "/#/patients")
                time.sleep(3)
                self.enable_semantics()
                self.button("신규 환자", 20)
                self.note("로그인 성공")
                return
            except TimeoutException:
                self.shot(f"login{attempt}")
                self.d.get(BASE + "/#/patients")
                time.sleep(3)
                self.enable_semantics()
        raise RuntimeError("DS Core 로그인 실패 — 계정(settings.json)이나 화면 변경을 확인하세요. logs/ 의 dscore-login*.png 참고")

    # ---------- 환자 ----------

    def create_patient(self, first: str, last: str, card_id: str, birth: str) -> None:
        self.note(f"임시 환자 만드는 중: {last}, {first} ({card_id})")
        self.d.get(BASE + "/#/patients")
        time.sleep(2)
        self.enable_semantics()
        self.click(self.button("신규 환자"))
        self.type_into(self.input("이름"), first)
        self.type_into(self.input("성"), last)
        self.type_into(self.input("생년월일"), birth)
        self.type_into(self.input("카드 ID"), card_id)
        self.click(self.button("환자 추가", exact=True))
        # ★ "유사한 환자가 이미 존재합니다" — 지난번 못 지운 임시 환자가 있으면 묻습니다 → 새로 만듭니다
        for _ in range(10):
            time.sleep(1)
            dup = self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='새 환자 생성']")
            if dup:
                self.note("비슷한 임시 환자가 남아 있어 새로 만듭니다")
                self.click(dup[0])
                time.sleep(2)
                break
            if not self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='환자 추가']"):
                break
        time.sleep(1)

    def open_patient(self, card_id: str, display: str) -> None:
        """검색해서 줄을 누릅니다. 새 환자가 목록에 반영되기까지 몇 초 걸릴 수 있어 재시도."""
        for attempt in range(6):
            self.d.get(BASE + "/#/patients")
            time.sleep(2)
            self.enable_semantics()
            box = self.input("환자 검색", 20)
            self.type_into(box, card_id)
            time.sleep(2)
            rows = self.d.find_elements(By.XPATH, f"//flt-semantics[contains(normalize-space(.), '{display}') and not(.//flt-semantics[contains(normalize-space(.), '{display}')])]")
            if rows:
                self.click(rows[0])
                try:
                    WebDriverWait(self.d, 15).until(lambda d: re.search(r"#/patients/[0-9a-f-]{36}", d.current_url))
                    time.sleep(2)
                    self.enable_semantics()
                    return
                except TimeoutException:
                    pass
            self.note(f"환자가 아직 목록에 없음 — 다시 ({attempt + 1}/6)")
            time.sleep(4)
        self.shot("open_patient")
        raise RuntimeError(f"환자 '{display}' 를 목록에서 못 찾았습니다")

    def delete_patient(self, card_id: str, display: str) -> None:
        self.note("임시 환자 지우는 중")
        try:
            self.d.get(BASE + "/#/patients")
            time.sleep(2)
            self.enable_semantics()
            self.type_into(self.input("환자 검색", 20), card_id)
            time.sleep(2)
            rows = self.d.find_elements(By.XPATH, f"//flt-semantics[contains(normalize-space(.), '{display}') and not(.//flt-semantics[contains(normalize-space(.), '{display}')])]")
            if not rows:
                # 카드 ID 로 안 잡히면 이름으로
                self.type_into(self.input("환자 검색", 20), display.split(",")[0])
                time.sleep(2)
                rows = self.d.find_elements(By.XPATH, f"//flt-semantics[contains(normalize-space(.), '{display}') and not(.//flt-semantics[contains(normalize-space(.), '{display}')])]")
            row = rows[0]
            # 줄의 ⋮ — 이름 뒤에 오는 첫 버튼
            dots = self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='']")
            self.cdp_click(dots[-1])
            time.sleep(1.5)
            self.cdp_click(self.innermost("삭제", 10))
            time.sleep(2)
            # ★ 확인창의 체크박스는 이름 없는 작은 버튼입니다 (2026-09-10 실측: role=button, 글자 없음,
            #   '데이터를 다른 곳에 저장했습니다.' 글자 바로 앞). 체크해야 '삭제' 가 버튼이 됩니다.
            self.innermost("저장했습니다", 10)
            small = [b for b in self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='']") if 8 < self.rect(b)[2] < 60]
            if not small:
                raise RuntimeError("확인창의 체크박스를 못 찾았습니다")
            self.cdp_click(small[-1])
            time.sleep(1)
            btn = WebDriverWait(self.d, 10).until(EC.presence_of_element_located((By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='삭제']")))
            self.cdp_click(btn)
            time.sleep(2)
            self.note("임시 환자 삭제됨")
        except Exception as e:  # noqa: BLE001
            self.shot("delete_patient")
            self.note(f"★ 임시 환자를 못 지웠습니다 ({e}). DS Core 에서 '{display}' 를 손으로 지우세요")

    # ---------- 업로드 ----------

    def upload_dxd(self, dxd: Path) -> None:
        self.note(f"dxd 올리는 중 ({dxd.stat().st_size / 1e6:.0f} MB)")
        zone = None
        for attempt in range(3):
            self.enable_semantics()
            self.click(self.button("미디어 업로드"))
            try:
                WebDriverWait(self.d, 15).until(EC.presence_of_element_located((By.CSS_SELECTOR, "[id^='dropzone-container-']")))
            except TimeoutException:
                self.shot(f"upload_panel{attempt}")
                continue
            time.sleep(1)
            zones = self.d.find_elements(By.CSS_SELECTOR, "[id^='dropzone-container-']")
            visible = [z for z in zones if z.size.get("width", 0) > 50]
            zone = (visible or zones)[0]
            break
        if zone is None:
            raise RuntimeError("업로드 창의 끌어다 놓기 영역을 못 찾았습니다")
        # 파일을 브라우저 안에 조각으로 넣어 File 객체를 만든 뒤 drop 이벤트로 떨어뜨립니다
        self.d.execute_script("window._chunks = [];")
        with open(dxd, "rb") as f:
            while True:
                buf = f.read(6 * 1024 * 1024)
                if not buf:
                    break
                self.d.execute_script(
                    "const s=atob(arguments[0]);const b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);window._chunks.push(b);",
                    base64.b64encode(buf).decode("ascii"),
                )
        self.d.execute_script(
            """
            const name = arguments[1];
            // ★ 형식은 빈 문자열 — 진짜로 .dxd 를 끌어다 놓을 때 Chrome 이 주는 값입니다.
            //   드롭존이 허용 목록(dropMIME)과 비교하므로 octet-stream 이면 거절됩니다.
            const file = new File(window._chunks, name, { type: '' });
            window._chunks = null;
            const dt = new DataTransfer(); dt.items.add(file);
            // ★ 보이는 영역 **하나에만** — 둘 다에 떨어뜨리면 같은 파일이 두 번 올라갑니다 (2026-09-10)
            const zones = Array.from(document.querySelectorAll("[id^='dropzone-container-']"));
            const zone = zones.find(z => z.getBoundingClientRect().width > 50) || arguments[0] || zones[0];
            for (const t of ['dragenter', 'dragover', 'drop']) {
              zone.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
            }
            return zone.id;
            """,
            zone, dxd.name,
        )
        # ★ 떨어뜨리면 DS Core 가 **바로 올리기 시작**합니다 (2026-09-10 확인 — 버튼을
        #   안 눌러도 올라감). '파일 업로드 (1)' 버튼이 살아 있으면 눌러 줍니다.
        time.sleep(3)
        for _ in range(10):
            btns = self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and contains(normalize-space(.), '파일 업로드') and contains(normalize-space(.), '1')]")
            if btns:
                self.click(btns[0])
                break
            time.sleep(1)
        # ★ 패널(모달)이 열려 있는 동안은 뒤쪽 화면의 접근성 정보가 감춰집니다 — 카드를
        #   보려면 먼저 닫아야 합니다 (2026-09-10 — 이걸 몰라 카드가 떠 있는데 10분 기다렸음).
        self.note("DS Core 가 처리하는 중 (보통 1~3분, 최대 10분)")
        deadline = time.time() + 600
        while time.time() < deadline:
            for label in ("닫기", "취소"):
                bs = self.d.find_elements(By.XPATH, f"//flt-semantics[@role='button' and normalize-space(.)='{label}']")
                if bs:
                    self.click(bs[-1])
                    time.sleep(1)
            self.enable_semantics()
            # 처리가 끝나면 카드 글자가 '.dxd' 자리표시에서 파일 이름 'DI_2026-…' 로 바뀝니다
            # ★ 카드 이름은 화면 글자가 아니라 aria-label 에 있습니다: "Media tile DI_2026-…dxd DI (3)"
            if self.d.find_elements(By.XPATH, "//flt-semantics[contains(@aria-label, 'DI_') or contains(normalize-space(.), 'DI_')]"):
                break
            time.sleep(5)
        else:
            self.shot("upload_wait")
            raise RuntimeError("DS Core 처리가 10분 안에 안 끝났습니다")
        time.sleep(1)

    # ---------- 내보내기 ----------

    def export_exocad(self) -> Path:
        """
        ★ 카드는 처리 중에도 뜹니다(회색). 그때는 ⋮ 메뉴가 안 열립니다 → 메뉴에
          '다른 이름으로 다운로드' 가 나올 때까지 몇 초마다 다시 시도합니다.
        ★ ⋮ 는 좌표 클릭, '다른 이름으로 다운로드' 는 **마우스 올리기**로 하위 메뉴가 열리고,
          '.exocad' 는 좌표 클릭 (2026-09-10 실측).
        """
        self.note("exocad 내보내기 — DS Core 처리가 끝나기를 기다리며 메뉴를 확인")
        deadline = time.time() + 600
        while time.time() < deadline:
            self.enable_semantics()
            dots = self.d.find_elements(By.XPATH, "//flt-semantics[@role='button' and normalize-space(.)='']")
            if dots:
                self.cdp_click(dots[-1])
                time.sleep(2)
                items = self.d.find_elements(By.XPATH, "//flt-semantics[contains(normalize-space(.), '다른 이름으로 다운로드') and not(.//flt-semantics[contains(normalize-space(.), '다른 이름으로 다운로드')])]")
                if items:
                    self.cdp_hover(items[0])
                    time.sleep(2)
                    exo = self.innermost(".exocad", 10)
                    self.cdp_click(exo)
                    break
                self.d.execute_cdp_cmd("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape", "code": "Escape"})
                self.d.execute_cdp_cmd("Input.dispatchKeyEvent", {"type": "keyUp", "key": "Escape", "code": "Escape"})
            time.sleep(8)
        else:
            self.shot("export_wait")
            raise RuntimeError("10분 안에 내보내기 메뉴가 열리지 않았습니다 (DS Core 처리 지연?)")

        self.note("zip 내려받는 중")
        deadline = time.time() + 600
        while time.time() < deadline:
            zips = list(self.download_dir.glob("*.zip"))
            partial = list(self.download_dir.glob("*.crdownload"))
            if zips and not partial:
                time.sleep(1)
                return zips[0]
            time.sleep(2)
        self.shot("download_wait")
        raise RuntimeError("zip 이 10분 안에 안 내려왔습니다")

    def close(self) -> None:
        try:
            self.d.quit()
        except Exception:  # noqa: BLE001
            pass


# ---------- zip → 케이스 폴더 ----------

def place_export(zip_path: Path, folder: Path, folder_name: str, note=lambda m: None) -> list[Path]:
    """upperjaw / upperjaw-gingiva / lowerjaw ply 를 케이스 이름으로 바꿔 넣습니다."""
    out: list[Path] = []
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            low = info.filename.lower()
            if not low.endswith(".ply"):
                continue  # 빈 .dentalproject 는 버립니다 — 우리 주문서가 더 낫습니다
            m = re.search(r"-(upperjaw-gingiva|lowerjaw-gingiva|upperjaw|lowerjaw|bite|occlusion)\.ply$", low)
            suffix = m.group(1) if m else Path(info.filename).stem
            target = folder / f"{folder_name}-{suffix}.ply"
            with z.open(info) as src, open(target, "wb") as dst:
                shutil.copyfileobj(src, dst)
            out.append(target)
            note(f"{info.filename} → {target.name}")
    return out


def split_name(name: str) -> tuple[str, str]:
    """덴플로우 환자명 → (이름, 성). 한글 세 글자면 성 1 + 이름 2. 공백이 있으면 그걸로."""
    name = name.strip()
    if " " in name:
        last, first = name.split(" ", 1)
        return first.strip(), last.strip()
    if len(name) >= 2:
        return name[1:], name[0]
    return name, name


LOCK = HERE / "dscore.lock"


def _acquire_lock(say, wait_minutes: int = 20) -> None:
    """★ dxd 두 건을 동시에 보내면 전용 Chrome 프로필이 겹쳐 둘 다 망가집니다 (2026-09-10).
       먼저 온 것이 끝날 때까지 뒤의 것이 기다립니다. 죽은 잠금(30분 이상)은 무시합니다."""
    import os
    deadline = time.time() + wait_minutes * 60
    while True:
        try:
            if LOCK.exists() and time.time() - LOCK.stat().st_mtime > 1800:
                LOCK.unlink()
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return
        except FileExistsError:
            if time.time() > deadline:
                raise RuntimeError("다른 dxd 변환이 20분 넘게 끝나지 않아 기다리기를 멈췄습니다") from None
            say("다른 dxd 변환이 진행 중 — 끝나기를 기다립니다")
            time.sleep(10)


def _release_lock() -> None:
    try:
        LOCK.unlink()
    except FileNotFoundError:
        pass


def convert(dxd: Path, folder: Path, folder_name: str, patient_name: str, card_id: str, show: bool = False, say=None) -> list[Path]:
    say = say or (lambda m: None)
    _acquire_lock(say)
    try:
        return _convert(dxd, folder, folder_name, patient_name, card_id, show, say)
    finally:
        _release_lock()


def _convert(dxd: Path, folder: Path, folder_name: str, patient_name: str, card_id: str, show: bool, say) -> list[Path]:
    # ★ 임시 환자 이름은 **영어 + 주문번호** (사용자 지시 2026-09-10 — "환자명은 영어로, 중복 안 되게").
    #   덴플로우 환자명은 우리 .dentalProject 에 들어가므로 DS Core 쪽 이름은 아무래도 됩니다.
    #   카드 ID 에 초 단위 시각을 붙여 같은 주문을 다시 보내도 안 겹칩니다.
    # ★ 덴플로우와 엮이는 이름은 쓰지 않습니다 (사용자 지시 2026-09-10 — 클라우드에 올라가는 것이라).
    #   "Demo, Case<초단위시각>" 처럼 뜻 없는 영어 + 고유 숫자. 카드 ID 도 TMP-… 로.
    stamp = str(int(time.time()))
    first, last = "Demo", f"Case{stamp[-7:]}"
    card_id = f"TMP-{stamp}"
    display = f"{last}, {first}"
    birth = time.strftime("%Y-%m-%d")
    tmp = Path(tempfile.mkdtemp(prefix="dscore-"))
    ds = DSCore(tmp, show=show, say=say)
    try:
        ds.ensure_login()
        ds.create_patient(first, last, card_id, birth)
        ds.open_patient(card_id, display)
        ds.upload_dxd(dxd)
        z = ds.export_exocad()
        placed = place_export(z, folder, folder_name, say)
        ds.delete_patient(card_id, display)
        return placed
    except Exception:
        ds.shot("error")
        raise
    finally:
        ds.close()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    if len(sys.argv) < 3:
        raise SystemExit("사용: dscore.py <dxd> <케이스 폴더> [--show]")
    dxd, folder = Path(sys.argv[1]), Path(sys.argv[2])
    files = convert(dxd, folder, folder.name, folder.name.split("_", 1)[-1], f"DF-{int(time.time())}", show="--show" in sys.argv, say=print)
    print("done:", [f.name for f in files])
