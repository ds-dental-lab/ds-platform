# -*- coding: utf-8 -*-
"""
바로가기(.lnk)를 **파이썬 안에서** 만들고 읽습니다 (2026-10-19).

★★ 왜 — 전에는 pythonw 가 powershell 을 띄워 WScript.Shell 로 시작프로그램에
  바로가기를 썼습니다. 보안 모듈(nProtect·V3 행동 감시)이 가장 먼저 의심하는
  모양이 "스크립트가 powershell 을 불러 자동 시작을 심는다" 입니다. 실제로 악성인지와
  상관없이 모양만으로 물어볼 수 있어서, 치과 직원 앞에서 뜨기 전에 미리 바꿨습니다
  (사용자 결정 2026-10-19 "사후처리보다는 미리").
★ 윈도우가 쓰는 같은 셸 링크 객체(IShellLinkW)를 **같은 프로세스 안에서** 부릅니다 —
  새 프로그램을 띄우지 않습니다. 파이썬 표준 ctypes 만 씁니다(설치할 것 없음).
★ 윈도우가 아니면 아무것도 안 합니다(False / None).
"""

from __future__ import annotations

import ctypes
import os
from ctypes import wintypes

SW_SHOWMINNOACTIVE = 7
MAX_PATH = 32768


class _GUID(ctypes.Structure):
    _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]


def _guid(s: str) -> _GUID:
    g = _GUID()
    ctypes.oledll.ole32.CLSIDFromString(ctypes.c_wchar_p(s), ctypes.byref(g))
    return g


CLSID_ShellLink = "{00021401-0000-0000-C000-000000000046}"
IID_IShellLinkW = "{000214F9-0000-0000-C000-000000000046}"
IID_IPersistFile = "{0000010B-0000-0000-C000-000000000046}"

# vtable 자리 (IUnknown 0~2 다음)
_QI, _RELEASE = 0, 2
_GETPATH, _SETWORKDIR, _SETARGS, _SETSHOW, _SETICON, _SETPATH = 3, 9, 11, 15, 17, 20
_LOAD, _SAVE = 5, 6  # IPersistFile


def _call(obj, index: int, restype, *args):
    vtbl = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    proto = ctypes.WINFUNCTYPE(restype, ctypes.c_void_p, *[type(a) for a in args])
    return proto(vtbl[index])(obj, *args)


class _Link:
    """IShellLinkW + IPersistFile 한 쌍. with 로 쓰면 다 놓아 줍니다"""

    def __enter__(self):
        ole = ctypes.oledll.ole32
        self._inited = ole.CoInitialize(None) in (0, 1)  # S_OK·S_FALSE
        self.link = ctypes.c_void_p()
        ole.CoCreateInstance(ctypes.byref(_guid(CLSID_ShellLink)), None, 1,  # CLSCTX_INPROC_SERVER
                             ctypes.byref(_guid(IID_IShellLinkW)), ctypes.byref(self.link))
        self.file = ctypes.c_void_p()
        # ★ GUID 를 변수에 붙들어 둡니다 — 임시로 만들면 부르는 사이 지워져 E_NOINTERFACE (실측)
        iid = _guid(IID_IPersistFile)
        hr = _call(self.link, _QI, ctypes.HRESULT,
                   ctypes.c_void_p(ctypes.addressof(iid)),
                   ctypes.c_void_p(ctypes.addressof(self.file)))
        if hr:
            raise OSError(hr, "IPersistFile")
        return self

    def __exit__(self, *exc):
        for p in (getattr(self, "file", None), getattr(self, "link", None)):
            if p:
                _call(p, _RELEASE, ctypes.c_ulong)
        if self._inited:
            ctypes.oledll.ole32.CoUninitialize()


def _w(s: str) -> ctypes.c_wchar_p:
    return ctypes.c_wchar_p(str(s))


def write_link(lnk, target, args: str = "", workdir=None, icon=None, minimized: bool = False) -> bool:
    """바로가기를 만듭니다(있으면 덮어씀). 되면 True"""
    if os.name != "nt":
        return False
    try:
        with _Link() as L:
            _call(L.link, _SETPATH, ctypes.HRESULT, _w(target))
            if args:
                _call(L.link, _SETARGS, ctypes.HRESULT, _w(args))
            if workdir:
                _call(L.link, _SETWORKDIR, ctypes.HRESULT, _w(workdir))
            if icon:
                _call(L.link, _SETICON, ctypes.HRESULT, _w(icon), ctypes.c_int(0))
            if minimized:
                _call(L.link, _SETSHOW, ctypes.HRESULT, ctypes.c_int(SW_SHOWMINNOACTIVE))
            _call(L.file, _SAVE, ctypes.HRESULT, _w(lnk), wintypes.BOOL(True))
        return True
    except OSError:
        return False


def read_target(lnk) -> str | None:
    """바로가기가 가리키는 곳. 못 읽으면 None (한글 경로도 그대로 — 콘솔을 거치지 않습니다)"""
    if os.name != "nt" or not os.path.exists(str(lnk)):
        return None
    try:
        with _Link() as L:
            _call(L.file, _LOAD, ctypes.HRESULT, _w(lnk), wintypes.DWORD(0))
            buf = ctypes.create_unicode_buffer(MAX_PATH)
            _call(L.link, _GETPATH, ctypes.HRESULT, buf, ctypes.c_int(MAX_PATH),
                  ctypes.c_void_p(None), wintypes.DWORD(0))
        return buf.value or None
    except OSError:
        return None
