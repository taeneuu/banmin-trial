/**
 * 광복 1945 + 반민특위 재판정 공용 제출 스크립트
 * 같은 스프레드시트에서 앱별로 다른 시트에 저장한다.
 * - 반민특위 재판정: 'app' 값이 'banmin' → '반민특위 재판정' 시트
 * - 광복 1945: 'app' 값이 없음 → 기존 '응답' 시트 (예전과 똑같이 동작)
 */
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const d = JSON.parse(e.postData.contents);

  if (d.app === 'banmin') {
    const sh = ss.getSheetByName('반민특위 재판정') || ss.insertSheet('반민특위 재판정');
    if (sh.getLastRow() === 0) {
      sh.appendRow(['제출 시각', '학번 이름', '적용 조항', '제출 증거', '기소 이유',
                    '구형', '쟁점 발견', '보완 조사 사용', '성찰 답변', '전체 기록']);
    }
    sh.appendRow([new Date(), d.name, d.laws, d.evidence, d.reason,
                  d.sentence, d.issue, d.chances, d.reflection, d.all]);
    return ContentService.createTextOutput('ok');
  }

  // 광복 1945 (기존 코드 그대로)
  const sh = ss.getSheetByName('응답') || ss.insertSheet('응답');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['제출 시각','학번 이름','선택한 인물','무엇부터 해결할까','38선을 그은 까닭',
                  '질문1 동의 여부','질문1 답','질문2 답','전체 기록']);
  }
  sh.appendRow([new Date(), d.name, d.route, d.s1, d.s38, d.agree, d.q1, d.q2, d.all]);
  return ContentService.createTextOutput('ok');
}
