package com.skku.oeji;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@SpringBootApplication
@RestController
@CrossOrigin(origins = "*")
public class OejiApplication {

    private static final String GEMINI_API_KEY = "AQ.Ab8RN6KCR4RP5NKLTGdpzQpZLXedLapFi6oXb6jOokN44LYw8g";
    private static final String GEMINI_MODEL = "gemini-1.5-flash";

    // 인메모리 저장소 (세션/테스트용)
    private static final List<Map<String, Object>> IN_MEMORY_RECORDS = new ArrayList<>();

    public static void main(String[] args) {
        SpringApplication.run(OejiApplication.class, args);
    }

    // 1. 초기 부트스트랩 데이터 조회
    @GetMapping("/api/bootstrap")
    public ResponseEntity<Map<String, Object>> getBootstrap() {
        Map<String, Object> response = new HashMap<>();
        response.put("user", Map.of("name", "이하연", "email", "student@skku.edu"));
        response.put("peer", Map.of("in", 45, "ui", 50, "ye", 35, "ji", 70));
        response.put("records", IN_MEMORY_RECORDS);

        Map<String, Object> cfg = new HashMap<>();
        cfg.put("defaultSemester", "2026-1");
        cfg.put("SCORE_PER_TAG", 10);
        cfg.put("SEMESTERS", List.of("2024-1", "2024-2", "2025-1", "2025-2", "2026-1", "2026-2"));
        cfg.put("TYPES", List.of("수업/과제", "비교과", "URP/연구실", "동아리/학회"));
        cfg.put("CAREERS", List.of("기업 R&D 취업", "학술 연구 / 대학원", "기술 창업", "공공·사회혁신"));
        cfg.put("GROUPS", List.of("role", "tool", "method", "trouble"));

        Map<String, Object> tags = new HashMap<>();
        tags.put("role", Map.of("max", 2, "items", Map.of("PM/팀장", "ui", "실험/데이터분석", "ji", "기획", "ji", "문서작성/발표", "ye")));
        tags.put("tool", Map.of("items", Map.of("Python", "ji", "Excel수치해석", "ji", "통계분석", "ji", "시각화툴(Figma)", "ye", "CAD", "ji", "SPSS", "ji")));
        tags.put("method", Map.of("items", Map.of("수치해석", "ji", "설문설계", "ye", "시뮬레이션", "ji", "논문분석", "ji")));
        tags.put("trouble", Map.of("max", 2, "items", Map.of("오차원인_규명", "ji", "갈등조율", "in", "일정재조정", "ui", "피드백반영", "ui")));
        cfg.put("TAGS", tags);

        cfg.put("RECOMMEND", Map.of(
                "수업/과제", List.of("실험/데이터분석", "오차원인_규명"),
                "비교과", List.of("갈등조율", "문서작성/발표"),
                "URP/연구실", List.of("Python", "오차원인_규명", "수치해석"),
                "동아리/학회", List.of("PM/팀장", "기획")
        ));

        cfg.put("ACTIVITY_PRESETS", Map.of(
                "수업/과제", List.of("신소재공학개론1", "창의적융합디자인", "일반물리학실험"),
                "비교과", List.of("글로벌 버디 멘토링", "HUSS 국외탐방", "학생성공 학습동아리"),
                "URP/연구실", List.of("동계 차세대 융합 모빌리티 URP", "나노소재 합성 랩 인턴"),
                "동아리/학회", List.of("AI·SW 융합 해커톤", "SEMIST 반도체 학술동아리")
        ));

        cfg.put("BADGES", Map.of("in", "따뜻한 공감가", "ui", "원칙의 수호자", "ye", "열린 소통가", "ji", "실전 문제해결사"));
        cfg.put("PERSONA", Map.of(
                "in+ui", "공감적 정의수호가",
                "in+ye", "포용적 관계수호자",
                "in+ji", "자비로운 통찰자",
                "ui+ye", "품격있는 원칙주의자",
                "ui+ji", "합리적 결단자",
                "ye+ji", "유연한 처세술자"
        ));
        cfg.put("PERSONA_SOLO", Map.of("in", "인간애의 실천가", "ui", "책임감 있는 완수자", "ye", "글로벌 소통가", "ji", "지적 탐구자"));

        cfg.put("PLANS", Map.of(
                "기업 R&D 취업", List.of(
                        Map.of("title", "신소재 기초 수치해석 마스터", "type", "수업/과제", "tags", List.of("Excel수치해석", "수치해석"), "req", true),
                        Map.of("title", "차세대 배터리/반도체 URP 랩 인턴", "type", "URP/연구실", "tags", List.of("실험/데이터분석", "오차원인_규명"), "req", true)
                )
        ));

        cfg.put("NOTICES", List.of(
                Map.of("id", "N01", "daysLeft", 3, "deadline", "2026.10.15", "org", "공과대/성균융합원",
                        "title", "동계 차세대 융합 모빌리티 URP 학부연구생 모집",
                        "reason", "로드맵 목표인 [#실험_데이터분석]을 실전에서 쌓을 수 있습니다.",
                        "tags", List.of("URP", "실험/데이터분석", "Python"), "careers", List.of("기업 R&D 취업"), "link", "https://skku.edu"),
                Map.of("id", "N02", "daysLeft", 7, "deadline", "2026.10.20", "org", "챌린지스퀘어",
                        "title", "글로벌 버디(Global Buddy) 멘토링 프로그램 모집",
                        "reason", "현재 포트폴리오에서 부족한 [소통·협업(禮)] 역량을 보완할 수 있습니다.",
                        "tags", List.of("비교과", "문서작성/발표", "갈등조율"), "careers", List.of("기업 R&D 취업"), "link", "https://skku.edu")
        ));

        cfg.put("STORIES", List.of(
                Map.of("who", "신소재공학 → 모빌리티 R&D 진출 선배 (21학번)", "goal", "기업 R&D 취업",
                        "path", List.of(
                                Map.of("y", "1학년", "t", "공학수학 기초 이수 & 자기주도 학습동아리"),
                                Map.of("y", "2학년", "t", "교내 AI 해커톤 출전 (#Python, #오차원인_규명)"),
                                Map.of("y", "3학년", "t", "동계 모빌리티 URP 랩 인턴 & 산학 Co-op 실습")
                        ), "link", "https://skku.edu")
        ));

        response.put("cfg", cfg);
        return ResponseEntity.ok(response);
    }

    // 2. 3분 기록 저장 및 역량 점수 계산
    @PostMapping("/api/records")
    public ResponseEntity<Map<String, Object>> saveRecord(@RequestBody Map<String, Object> form) {
        String nowStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy.MM.dd"));
        String recId = "REC_" + System.currentTimeMillis();

        Map<String, List<String>> tags = (Map<String, List<String>>) form.getOrDefault("tags", Collections.emptyMap());
        Map<String, Integer> sc = new HashMap<>(Map.of("in", 0, "ui", 0, "ye", 0, "ji", 0));

        List<String> allTags = new ArrayList<>();
        tags.values().forEach(allTags::addAll);

        for (String t : allTags) {
            if (t.contains("실험") || t.contains("Python") || t.contains("Excel") || t.contains("오차") || t.contains("수치해석") || t.contains("기획") || t.contains("통계")) {
                sc.put("ji", sc.get("ji") + 10);
            } else if (t.contains("PM") || t.contains("일정") || t.contains("피드백")) {
                sc.put("ui", sc.get("ui") + 10);
            } else if (t.contains("갈등")) {
                sc.put("in", sc.get("in") + 10);
            } else if (t.contains("문서") || t.contains("시각화") || t.contains("설문")) {
                sc.put("ye", sc.get("ye") + 10);
            }
        }

        Map<String, Object> result = new HashMap<>(form);
        result.put("id", recId);
        result.put("ts", nowStr);
        result.put("sem", form.getOrDefault("semester", "2026-1"));
        result.put("role", tags.getOrDefault("role", Collections.emptyList()));
        result.put("tool", tags.getOrDefault("tool", Collections.emptyList()));
        result.put("method", tags.getOrDefault("method", Collections.emptyList()));
        result.put("trouble", tags.getOrDefault("trouble", Collections.emptyList()));
        result.put("sc", sc);
        result.put("bm", false);

        IN_MEMORY_RECORDS.add(result);
        return ResponseEntity.ok(result);
    }

    // 3. 북마크 토글
    @PutMapping("/api/records/{id}/bookmark")
    public ResponseEntity<Boolean> toggleBookmark(@PathVariable("id") String id) {
        for (Map<String, Object> r : IN_MEMORY_RECORDS) {
            if (id.equals(r.get("id"))) {
                boolean cur = Boolean.TRUE.equals(r.get("bm"));
                r.put("bm", !cur);
                return ResponseEntity.ok(!cur);
            }
        }
        return ResponseEntity.ok(false);
    }

    // 4. 로드맵 상태 저장
    @PostMapping("/api/roadmap")
    public ResponseEntity<Boolean> saveRoadmap(@RequestBody String roadmapJson) {
        return ResponseEntity.ok(true);
    }

    // 5. Gemini 콤비네이션 캡션 생성
    @PostMapping("/api/ai/link")
    public ResponseEntity<String> aiLink(@RequestBody Map<String, String> body) {
        String titleA = body.getOrDefault("titleA", "선행활동");
        String titleB = body.getOrDefault("titleB", "후속활동");
        String fallback = String.format("\"%s\"의 경험이 \"%s\"의 핵심 역량으로 연결되었습니다.", titleA, titleB);

        try {
            String prompt = String.format(
                "대학생의 두 활동을 연결하는 성장 인과관계를 1문장(50자 이내)으로 요약해줘.\n" +
                "- 선행: %s, 후속: %s\n" +
                "형식: \"[%s] 활동을 통해 얻은 역량이 [%s] 활동으로 이어졌습니다.\"",
                titleA, titleB, titleA, titleB
            );

            String jsonPayload = String.format(
                "{\"contents\":[{\"parts\":[{\"text\":\"%s\"}]}]}",
                prompt.replace("\n", "\\n").replace("\"", "\\\"")
            );

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

            HttpResponse<String> resp = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() == 200 && resp.body().contains("\"text\": \"")) {
                String text = resp.body().split("\"text\": \"")[1].split("\"")[0];
                return ResponseEntity.ok(text.replace("\\n", " ").trim());
            }
        } catch (Exception ignored) {
        }
        return ResponseEntity.ok(fallback);
    }

    // 6. Gemini 역량 갭 추천
    @GetMapping("/api/ai/gap")
    public ResponseEntity<Map<String, String>> aiGap(@RequestParam("weak") String weak, @RequestParam(value = "career", required = false) String career) {
        Map<String, Map<String, String>> dummy = Map.of(
                "in", Map.of("title", "신입생 전공 멘토링 프로그램", "tag", "#갈등조율", "reason", "공감과 배려 역량을 넓혀보세요.", "link", "https://skku.edu"),
                "ui", Map.of("title", "산학협력 Co-op 인턴십 실습", "tag", "#일정재조정", "reason", "실무 마감을 준수하며 책임감을 증명하세요.", "link", "https://skku.edu"),
                "ye", Map.of("title", "글로벌 버디 멘토링 프로그램", "tag", "#문서작성/발표", "reason", "글로벌 소통(禮) 역량을 확장하세요.", "link", "https://skku.edu"),
                "ji", Map.of("title", "동계 차세대 융합 모빌리티 URP", "tag", "#실험/데이터분석", "reason", "연구실 연구로 문제해결(智) 스탯을 채워보세요.", "link", "https://skku.edu")
        );
        return ResponseEntity.ok(dummy.getOrDefault(weak, dummy.get("ye")));
    }
}
