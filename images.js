/* 이미지 목록과 출처 (모두 Wikimedia Commons에서 라이선스 확인, 2026-10-28)
 * kind: 'source' = 실제 역사 사료 사진 / 'ref' = 참고 이미지(사건과 직접 관련된 자료는 아님) / 'mood' = 분위기용
 * GitHub Pages에서 Wikimedia 서버의 이미지를 직접 불러온다. 불러오지 못하면 일러스트로 대체된다.
 */
const IMAGES = {
  park1940: {
    kind: 'source', title: '박흥식 (1940년 7월 7일자 매일신보에 실린 사진)', date: '1940년 7월 7일',
    big: 'https://upload.wikimedia.org/wikipedia/ko/c/c1/%EB%B0%95%ED%9D%A5%EC%8B%9D.jpg',
    small: 'https://upload.wikimedia.org/wikipedia/ko/c/c1/%EB%B0%95%ED%9D%A5%EC%8B%9D.jpg',
    page: 'https://ko.wikipedia.org/wiki/%ED%8C%8C%EC%9D%BC:%EB%B0%95%ED%9D%A5%EC%8B%9D.jpg',
    credit: '매일신보 · 한국어 위키백과 · 퍼블릭 도메인',
  },
  hwashin: {
    kind: 'source', title: '1940년대 초 화신백화점', date: '1941년 무렵',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Whashin_Department_Store_around_early_1940s.jpg/1280px-Whashin_Department_Store_around_early_1940s.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Whashin_Department_Store_around_early_1940s.jpg/500px-Whashin_Department_Store_around_early_1940s.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Whashin_Department_Store_around_early_1940s.jpg',
    credit: '작자 미상 · 서울역사아카이브 · 퍼블릭 도메인',
  },
  jongno1936: {
    kind: 'mood', title: '경성우편국에서 본 거리 (엽서)', date: '1936년 무렵',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/View_from_Keijo_Post_Office_%28c._1936%29.jpg/1280px-View_from_Keijo_Post_Office_%28c._1936%29.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2e/View_from_Keijo_Post_Office_%28c._1936%29.jpg/500px-View_from_Keijo_Post_Office_%28c._1936%29.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:View_from_Keijo_Post_Office_(c._1936).jpg',
    credit: '작자 미상 · 퍼블릭 도메인',
  },
  seoul1945: {
    kind: 'mood', title: '1945년 12월의 서울', date: '1945년 12월',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Seoul_1945.jpg/1280px-Seoul_1945.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Seoul_1945.jpg/500px-Seoul_1945.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Seoul_1945.jpg',
    credit: 'Don O’Brien · CC BY 2.0',
  },
  street1946: {
    kind: 'mood', title: '서울 거리 풍경', date: '1946년 5월',
    big: 'https://upload.wikimedia.org/wikipedia/commons/4/48/Street_scene_in_Seoul%2C_Korea_%28May_1946%29.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Street_scene_in_Seoul%2C_Korea_%28May_1946%29.jpg/500px-Street_scene_in_Seoul%2C_Korea_%28May_1946%29.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Street_scene_in_Seoul,_Korea_(May_1946).jpg',
    credit: '미 육군 통신대 · 트루먼 도서관 · 퍼블릭 도메인',
  },
  streetcar1945: {
    kind: 'mood', title: '전차가 다니는 서울 거리', date: '1945년 10월',
    big: 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Seoul%2C_Korea_October_1945_%284484318764%29.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Seoul%2C_Korea_October_1945_%284484318764%29.jpg/500px-Seoul%2C_Korea_October_1945_%284484318764%29.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Seoul,_Korea_October_1945_(4484318764).jpg',
    credit: 'Don O’Brien · CC BY 2.0',
  },
  trial1949: {
    kind: 'source', title: '반민특위 재판 광경', date: '1949년',
    big: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84.jpg',
    small: 'https://upload.wikimedia.org/wikipedia/commons/5/5b/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84.jpg',
    credit: '작자 미상 · 퍼블릭 도메인',
  },
  news1949: {
    kind: 'source', title: '반민특위 활동 시작을 보도한 조선일보', date: '1949년 1월 11일',
    big: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EB%B3%B4%EB%8F%84.jpg',
    small: 'https://upload.wikimedia.org/wikipedia/commons/d/d8/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EB%B3%B4%EB%8F%84.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EB%B3%B4%EB%8F%84.jpg',
    credit: '조선일보 · 퍼블릭 도메인',
  },
  transfer1949: {
    kind: 'source', title: '반민특위에 체포되어 이송되는 김연수·최린', date: '1949년 1월',
    big: 'https://upload.wikimedia.org/wikipedia/commons/4/43/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EC%B2%B4%ED%8F%AC%EC%9E%90_%EC%9D%B4%EC%86%A1_%EC%9E%A5%EB%A9%B4.jpg',
    small: 'https://upload.wikimedia.org/wikipedia/commons/4/43/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EC%B2%B4%ED%8F%AC%EC%9E%90_%EC%9D%B4%EC%86%A1_%EC%9E%A5%EB%A9%B4.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%EC%B2%B4%ED%8F%AC%EC%9E%90_%EC%9D%B4%EC%86%A1_%EC%9E%A5%EB%A9%B4.jpg',
    credit: '작자 미상 · 퍼블릭 도메인',
  },
  ballotbox1948: {
    kind: 'source', title: '반민특위 전라남도 조사부의 투서함', date: '1948년 10월',
    big: 'https://upload.wikimedia.org/wikipedia/commons/7/76/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%ED%88%AC%EC%84%9C%ED%95%A8.jpg',
    small: 'https://upload.wikimedia.org/wikipedia/commons/7/76/%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%ED%88%AC%EC%84%9C%ED%95%A8.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:%EB%B0%98%EB%AF%BC%ED%8A%B9%EC%9C%84_%ED%88%AC%EC%84%9C%ED%95%A8.jpg',
    credit: '작자 미상 · 퍼블릭 도메인',
  },
  seal: {
    kind: 'source', title: '반민족행위특별조사위원회 위원장 인장 (유물 사진)', date: '2023년 촬영',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/%EB%B0%98%EB%AF%BC%EC%A1%B1%ED%96%89%EC%9C%84%ED%8A%B9%EB%B3%84%EC%A1%B0%EC%82%AC%EC%9C%84%EC%9B%90%ED%9A%8C_%EC%9C%84%EC%9B%90%EC%9E%A5_%EC%9D%B8%EC%9E%A5.jpg/500px-%EB%B0%98%EB%AF%BC%EC%A1%B1%ED%96%89%EC%9C%84%ED%8A%B9%EB%B3%84%EC%A1%B0%EC%82%AC%EC%9C%84%EC%9B%90%ED%9A%8C_%EC%9C%84%EC%9B%90%EC%9E%A5_%EC%9D%B8%EC%9E%A5.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e4/%EB%B0%98%EB%AF%BC%EC%A1%B1%ED%96%89%EC%9C%84%ED%8A%B9%EB%B3%84%EC%A1%B0%EC%82%AC%EC%9C%84%EC%9B%90%ED%9A%8C_%EC%9C%84%EC%9B%90%EC%9E%A5_%EC%9D%B8%EC%9E%A5.jpg/500px-%EB%B0%98%EB%AF%BC%EC%A1%B1%ED%96%89%EC%9C%84%ED%8A%B9%EB%B3%84%EC%A1%B0%EC%82%AC%EC%9C%84%EC%9B%90%ED%9A%8C_%EC%9C%84%EC%9B%90%EC%9E%A5_%EC%9D%B8%EC%9E%A5.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:%EB%B0%98%EB%AF%BC%EC%A1%B1%ED%96%89%EC%9C%84%ED%8A%B9%EB%B3%84%EC%A1%B0%EC%82%AC%EC%9C%84%EC%9B%90%ED%9A%8C_%EC%9C%84%EC%9B%90%EC%9E%A5_%EC%9D%B8%EC%9E%A5.jpg',
    credit: 'Cjb8293 · CC BY-SA 4.0',
  },
  maeil1945: {
    kind: 'ref', title: '매일신보 지면 (1945년 8월 15일자)', date: '1945년 8월 15일',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/1945%EB%85%84_8%EC%9B%94_15%EC%9D%BC_%EB%A7%A4%EC%9D%BC%EC%8B%A0%EB%B3%B4.jpg/1280px-1945%EB%85%84_8%EC%9B%94_15%EC%9D%BC_%EB%A7%A4%EC%9D%BC%EC%8B%A0%EB%B3%B4.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/1945%EB%85%84_8%EC%9B%94_15%EC%9D%BC_%EB%A7%A4%EC%9D%BC%EC%8B%A0%EB%B3%B4.jpg/500px-1945%EB%85%84_8%EC%9B%94_15%EC%9D%BC_%EB%A7%A4%EC%9D%BC%EC%8B%A0%EB%B3%B4.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:1945%EB%85%84_8%EC%9B%94_15%EC%9D%BC_%EB%A7%A4%EC%9D%BC%EC%8B%A0%EB%B3%B4.jpg',
    credit: '서울신문(해방공간 4대신문 영인본) · CC0',
    note: '참고 이미지: 박흥식의 글이 실린 지면이 아니다. 그가 글을 실었던 매일신보가 어떤 신문이었는지 보여 준다.',
  },
  ki9: {
    kind: 'ref', title: '일본군 95식 1형 연습기(Ki-9)', date: '1943년',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Tachikawa_Ki-9_in_Motooka_Airfield_1943.jpg/1280px-Tachikawa_Ki-9_in_Motooka_Airfield_1943.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Tachikawa_Ki-9_in_Motooka_Airfield_1943.jpg/500px-Tachikawa_Ki-9_in_Motooka_Airfield_1943.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Tachikawa_Ki-9_in_Motooka_Airfield_1943.jpg',
    credit: '작자 미상(후쿠오카 비행훈련소 관계자) · 퍼블릭 도메인',
    note: '참고 이미지: 조선비행기공업㈜이 만든 비행기가 아니다. 같은 시기 일본군이 쓰던 연습기의 모습이다.',
  },
  typewriter: {
    kind: 'mood', title: '1940년대 타자기', date: '2021년 촬영',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Woodstock_typewriter%2C_1940s.jpg/1280px-Woodstock_typewriter%2C_1940s.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Woodstock_typewriter%2C_1940s.jpg/500px-Woodstock_typewriter%2C_1940s.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Woodstock_typewriter,_1940s.jpg',
    credit: 'Cbaile19 · CC0',
  },
  office1943: {
    kind: 'mood', title: '1940년대 사무실 (헝가리)', date: '1943년',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Typewriter%2C_seal%2C_file_cabinet%2C_office_furniture%2C_office_Fortepan_105769.jpg/1280px-Typewriter%2C_seal%2C_file_cabinet%2C_office_furniture%2C_office_Fortepan_105769.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5b/Typewriter%2C_seal%2C_file_cabinet%2C_office_furniture%2C_office_Fortepan_105769.jpg/500px-Typewriter%2C_seal%2C_file_cabinet%2C_office_furniture%2C_office_Fortepan_105769.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Typewriter,_seal,_file_cabinet,_office_furniture,_office_Fortepan_105769.jpg',
    credit: 'Fortepan / Archiv für Zeitgeschichte ETH Zürich · CC BY-SA 3.0',
  },
  courthouse: {
    kind: 'mood', title: '서소문 옛 대법원 청사', date: '1983년 촬영',
    big: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Old_courthouse_of_the_Supreme_Court_of_Korea_at_Seosomun-dong_in_1983.jpg/1280px-Old_courthouse_of_the_Supreme_Court_of_Korea_at_Seosomun-dong_in_1983.jpg',
    small: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Old_courthouse_of_the_Supreme_Court_of_Korea_at_Seosomun-dong_in_1983.jpg/500px-Old_courthouse_of_the_Supreme_Court_of_Korea_at_Seosomun-dong_in_1983.jpg',
    page: 'https://commons.wikimedia.org/wiki/File:Old_courthouse_of_the_Supreme_Court_of_Korea_at_Seosomun-dong_in_1983.jpg',
    credit: '서울특별시청(서울역사아카이브) · 공공누리 제1유형',
  },
};

/* 증거 카드의 그림: img = 사진(IMAGES 키), illu = 일러스트 종류. 일러스트는 실제 자료가 아니라고 카드에 표시한다. */
const EVIDENCE_VISUAL = {
  E1: { illu: 'company', cat: 'biz' },
  E2: { illu: 'official', cat: 'doc' },
  E6: { illu: 'org', cat: 'doc' },
  E7: { img: 'maeil1945', cat: 'news' },
  E8: { illu: 'ledger', cat: 'etc' },
  D2: { img: 'hwashin', cat: 'biz' },
  D3: { illu: 'org', cat: 'doc' },
  D4: { illu: 'family', cat: 'etc' },
  D5: { img: 'news1949', cat: 'news' },
  E3: { illu: 'school', cat: 'biz' },
  E4: { img: 'ki9', cat: 'biz' },
  E5: { illu: 'ledger', cat: 'biz' },
};
const CATS = [
  { id: 'all', name: '모든 자료' },
  { id: 'news', name: '신문·사진' },
  { id: 'biz', name: '기업 기록' },
  { id: 'doc', name: '공문서·단체' },
  { id: 'etc', name: '기타' },
];
