/**
 * [오이지(Oeji) - 성균관대 커리어 아카이빙 플랫폼]
 * Apps Script Backend
 */

const SPREADSHEET_ID = "1KGN5uCW13aer18I0hsEy704wbAd7ic7G-8RzfDdrCCo";
const SHEET_NAME = "My_Records";
const GEMINI_API_KEY = "AQ.Ab8RN6KCR4RP5NKLTGdpzQpZLXedLapFi6oXb6jOokN44LYw8g";
const GEMINI_MODEL = "gemini-1.5-flash"; // 최신 Gemini Flash 엔드포인트

// 웹 앱 엔트리포인트 (HTML 서비스 서빙)
function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("오이지(Oeji) - 성균 성장 아카이브")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 초기 헤더가 없을 경우 자동 생성
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    const headers = [
      "Record_ID", "Timestamp", "Semester_ID", "User_ID", 
      "Activity_Type", "Activity_Name", "Role_Tags", "Tool_Tags", 
      "Method_Tags", "Trouble_Tags", "S_Situation", "T_Task", 
      "A_Action", "R_Result", "Reflection", "In_Score", 
      "Ui_Score", "Ye_Score", "Ji_Score", "Primary_Value", 
      "is_bookmarked", "parent_record_id"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#E8F5E9");
  }
  return sheet;
}

// 1. [Tab 1 & 공통] 전체 활동 기록 및 통계 데이터 조회
function getUserRecords(userId) {
  try {
    const sheet = getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { records: [], totalCount: 0 };

    const headers = data[0];
    const records = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!userId || row[3] === userId) {
        let record = {};
        headers.forEach((h, idx) => {
          record[h] = row[idx];
        });
        records.push(record);
      }
    }
    return { records: records, totalCount: records.length };
  } catch (error) {
    throw new Error("데이터 조회 실패: " + error.message);
  }
}

// 2. [Tab 2] 3분 기록 저장 처리
function savePortfolioRecord(formData) {
  try {
    const sheet = getOrCreateSheet();
    const now = new Date();
    const timestamp = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    const recordId = "REC_" + Utilities.formatDate(now, "Asia/Seoul", "yyyyMMdd_HHmmss");

    const row = [
      recordId,
      timestamp,
      formData.semesterId || "2026-1",
      formData.userId || "student@skku.edu",
      formData.activityType || "수업/과제",
      formData.activityName || "",
      (formData.roleTags || []).join(", "),
      (formData.toolTags || []).join(", "),
      (formData.methodTags || []).join(", "),
      (formData.troubleTags || []).join(", "),
      formData.starS || "",
      formData.starT || "",
      formData.starA || "",
      formData.starR || "",
      formData.reflection || "",
      Number(formData.inScore) || 0,
      Number(formData.uiScore) || 0,
      Number(formData.yeScore) || 0,
      Number(formData.jiScore) || 0,
      (formData.primaryValues || []).join(", "),
      formData.isBookmarked ? "TRUE" : "FALSE",
      formData.parentRecordId || ""
    ];

    sheet.appendRow(row);
    return { success: true, recordId: recordId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 3. Gemini API 연동 (STAR 기반 역량 코멘트 & 스토리 콤비네이션 텍스트 생성)
function generateCombinationStory(activityA, activityB) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `
대학생의 두 가지 활동을 바탕으로, 하나의 연결된 진로 스토리 문장을 작성해줘.
- 선행 활동: ${activityA}
- 후속 활동: ${activityB}
출력 규칙:
"A 활동(원인)을 통해 [핵심역량]을 쌓고, B 활동(확장)으로 이어졌습니다" 형태로 한국어 한 문장(50자 이내)으로 간결하게 작성해줘.
`;

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.candidates && result.candidates.length > 0) {
      return result.candidates[0].content.parts[0].text.trim();
    }
    return `[${activityA}] 활동을 통해 다진 역량이 [${activityB}] 목표로 자연스럽게 연결되었습니다.`;
  } catch (e) {
    return `[${activityA}] 활동의 역량이 [${activityB}] 실전 경험으로 확장되었습니다.`;
  }
}
