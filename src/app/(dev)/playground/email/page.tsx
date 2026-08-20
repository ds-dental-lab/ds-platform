// =========================================================
// 놓을 위치: src/app/(dev)/playground/email/page.tsx
//
// 메일 템플릿 시연 화면 (2026-08-21).
//
// ★ 붙여넣기 전에 여기서 봅니다. 대시보드에 넣고 확인하려면
//   그때마다 메일이 한 통씩 나갑니다 — 한도가 시간당 30통입니다.
//
// ★ 진짜 파일은 supabase/email-templates/ 에 있습니다.
//   여기 글자는 그 파일에서 옮겨 온 것이라, 고칠 때는 **거기를**
//   고치고 이 화면도 맞춰 주세요.
//
// ★★ **메일에는 바깥 여백을 주지 않습니다.**
//   처음에 p-8 을 물렸더니 폭을 64px 좁게 재고 있었습니다 —
//   "좁은 화면에서 넘치나" 를 보려고 만든 자리인데 그러면 실제보다
//   후하게 나옵니다. 글자만 여백을 갖습니다.
// =========================================================

export default function EmailPlayground() {
  return (
    <main>
      <div className="px-6 pt-8">
        <h1 className="text-2xl font-bold">메일 템플릿 시연</h1>
        <p className="mt-2 text-[13.5px] text-[#98A2B3]">
          supabase/email-templates/ 를 그대로 그립니다. 인증번호는 제일 긴 경우(10자리)로 채워
          뒀습니다 — 실제로는 6~8자리로 옵니다.
        </p>
        <h2 className="mt-7 font-semibold">① 비밀번호 재설정 (Reset Password)</h2>
      </div>

      <div dangerouslySetInnerHTML={{ __html: RECOVERY }} />

      <div className="px-6">
        <h2 className="font-semibold">② 가입 확인 (Confirm signup)</h2>
      </div>

      <div dangerouslySetInnerHTML={{ __html: CONFIRMATION }} />
    </main>
  );
}

const RECOVERY = String.raw`<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F9;margin:0;padding:32px 12px;width:100%;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E8EBF0;border-radius:12px;">

        
        <tr>
          <td style="padding:30px 34px 0 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#16324F;">DenFlow</div>
            <div style="height:3px;width:34px;background:#14B8A6;margin-top:7px;border-radius:2px;"></div>
            <div style="margin-top:9px;font-size:12.5px;color:#98A2B3;">덴플로우 디지털 기공소</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 34px 0 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="font-size:19px;font-weight:700;color:#1A2130;">비밀번호를 새로 정해 주세요</div>
            <div style="margin-top:10px;font-size:14.5px;line-height:1.65;color:#4A5567;">
              비밀번호 찾기를 요청하셨습니다.<br />
              아래 <b>인증번호</b>를 조금 전 화면에 넣어 주세요.
            </div>
          </td>
        </tr>

        
        <tr>
          
          <td style="padding:20px 18px 0 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F7FE;border:1px solid #C6DDF9;border-radius:10px;">
              <tr>
                <td align="center" style="padding:20px 10px;font-family:'Courier New',Consolas,monospace;font-size:26px;font-weight:700;letter-spacing:4px;color:#14538F;word-break:break-all;">
                  4839207156
                </td>
              </tr>
            </table>
            <div style="margin-top:9px;padding:0 16px;font-size:12.5px;color:#98A2B3;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
              한 시간 안에 넣어 주세요. 시간이 지나면 다시 받으셔야 합니다.
            </div>
          </td>
        </tr>

        
        <tr>
          <td style="padding:24px 34px 0 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="font-size:13.5px;color:#4A5567;">화면을 닫으셨다면 아래를 눌러 주세요.</div>
            <div style="margin-top:12px;">
              <a href="#"
                 style="display:inline-block;background:#1279E8;color:#FFFFFF;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 26px;border-radius:8px;">
                비밀번호 재설정하기
              </a>
            </div>
          </td>
        </tr>

        
        <tr>
          <td style="padding:26px 34px 30px 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="border-top:1px solid #E8EBF0;padding-top:16px;font-size:12.5px;line-height:1.7;color:#98A2B3;">
              요청하신 적이 없다면 이 메일은 그냥 두셔도 됩니다. 비밀번호는 바뀌지 않습니다.<br />
              이 메일은 발신 전용입니다. 궁금한 점은 덴플로우로 연락 주세요.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;

const CONFIRMATION = String.raw`<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F9;margin:0;padding:32px 12px;width:100%;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E8EBF0;border-radius:12px;">

        <tr>
          <td style="padding:30px 34px 0 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#16324F;">DenFlow</div>
            <div style="height:3px;width:34px;background:#14B8A6;margin-top:7px;border-radius:2px;"></div>
            <div style="margin-top:9px;font-size:12.5px;color:#98A2B3;">덴플로우 디지털 기공소</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 34px 0 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="font-size:19px;font-weight:700;color:#1A2130;">가입해 주셔서 감사합니다</div>
            <div style="margin-top:10px;font-size:14.5px;line-height:1.65;color:#4A5567;">
              아래를 눌러 이메일 확인을 마쳐 주세요.
            </div>
            <div style="margin-top:18px;">
              <a href="#"
                 style="display:inline-block;background:#1279E8;color:#FFFFFF;text-decoration:none;font-size:14.5px;font-weight:700;padding:12px 28px;border-radius:8px;">
                이메일 확인하기
              </a>
            </div>
          </td>
        </tr>

        
        <tr>
          <td style="padding:24px 34px 0 34px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFF8EC;border:1px solid #F5DCA9;border-radius:10px;">
              <tr>
                <td style="padding:15px 18px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;font-size:13.5px;line-height:1.65;color:#7A5B1B;">
                  확인을 마치신 뒤 <b>덴플로우의 승인</b>이 있어야 이용하실 수 있습니다.
                  승인되면 바로 로그인하실 수 있습니다.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 34px 30px 34px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif;">
            <div style="border-top:1px solid #E8EBF0;padding-top:16px;font-size:12.5px;line-height:1.7;color:#98A2B3;">
              가입하신 적이 없다면 이 메일은 그냥 두셔도 됩니다.<br />
              이 메일은 발신 전용입니다. 궁금한 점은 덴플로우로 연락 주세요.
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
