/* 리그 데이터: 미국(MLB), 일본(NPB), 대만(CPBL). 한국(KBO)은 index.html 기본값.
   선수 생성에서 고른 시작 리그에 따라 index.html의 setLeague()가 적용한다 */
window.B2_LEAGUES={
 MLB:{
 rule:{lg:'KBO',domestic:false,native:true,homeDraft:false,uniYears:3,mlbOffers:false,returnRule:'free',mil:'none',exempt:false,asian:false,
   faDom:[6,6],faAbroad:99,draftTeams:30,draftPicks:600,bonusMul:1,cur:'USD',
   sal:[[40,.35],[55,.45],[65,.6],[75,.9],[99,1.2]]},
 data:{
  teams:[],
  unis:['Vanderbilt','LSU','Texas A&M','Florida','Arkansas','Stanford','UCLA','Wake Forest','Tennessee','Oregon State'],
  ind:['Long Island Ducks','St. Paul Saints','Sugar Land Space Cowboys'],
  regions:['California','Texas','Florida','Georgia','Arizona','New York','Illinois','Ohio','Washington','North Carolina'],
  hs:{California:['Harvard-Westlake','JSerra Catholic','Mater Dei','St. John Bosco'],Texas:['Keller','Lake Travis','Bellaire'],Florida:['IMG Academy','American Heritage','Calvary Christian'],
      Georgia:['Buford','Parkview'],Arizona:['Hamilton','Brophy Prep'],'New York':['Xaverian','Monsignor Farrell'],Illinois:['Lincoln-Way East','Mount Carmel'],
      Ohio:['Archbishop Moeller'],Washington:['Puyallup'],'North Carolina':['Cardinal Gibbons']},
  fav:{California:['LA 다저스','샌프란시스코 자이언츠','샌디에이고 파드리스','LA 에인절스'],Texas:['텍사스 레인저스','휴스턴 애스트로스'],Florida:['마이애미 말린스','탬파베이 레이스'],
       Georgia:['애틀랜타 브레이브스'],Arizona:['애리조나 다이아몬드백스'],'New York':['뉴욕 양키스','뉴욕 메츠'],Illinois:['시카고 컵스','시카고 화이트삭스'],
       Ohio:['클리블랜드 가디언스','신시내티 레즈'],Washington:['시애틀 매리너스']}
 },
 hsTours:{
  wl1:{tag:'Mar',title:'Spring District Season',when:'Mar–Apr',host:'State High School Association',place:'District ballparks · weekends'},
  emart:{tag:'NHSI',title:'National High School Invitational',when:'Early April',host:'NHSI',place:'Cary, NC'},
  gold:{tag:'Region',title:'Regional Playoffs',nth:null,when:'May',host:'State High School Association',place:'Regional host sites'},
  wl2:{tag:'State',title:'State Playoffs',when:'May–June',host:'State High School Association',place:'Host sites statewide'},
  dragon:{tag:'PG',title:'Perfect Game National Showcase',nth:null,when:'June',host:'Perfect Game',place:'Phoenix, AZ'},
  pres:{tag:'ECP',title:'East Coast Pro',nth:null,when:'July',host:'East Coast Pro',place:'Hoover, AL'},
  phoenix:{tag:'Jupiter',title:'WWBA World Championship',nth:null,when:'October',host:'Perfect Game',place:'Jupiter, FL'},
  nat:{tag:'Area',title:'Area Code Games',nth:null,when:'August',host:'Area Code Games',place:'Long Beach, CA'}
 },
 /* 한국어 화면용 이름: 화면 언어가 한국어면 setLeague()가 위 데이터 대신 이 이름을 쓴다 */
 ko:{
  names:{'Long Island Ducks':'롱아일랜드 덕스','St. Paul Saints':'세인트폴 세인츠','Sugar Land Space Cowboys':'슈가랜드 스페이스 카우보이스','California':'캘리포니아','Texas':'텍사스','Florida':'플로리다','Georgia':'조지아','Arizona':'애리조나','New York':'뉴욕','Illinois':'일리노이','Ohio':'오하이오','Washington':'워싱턴','North Carolina':'노스캐롤라이나','Harvard-Westlake':'하버드웨스트레이크고','JSerra Catholic':'제이세라 가톨릭고','Mater Dei':'마터데이고','St. John Bosco':'세인트존보스코고','Keller':'켈러고','Lake Travis':'레이크트래비스고','Bellaire':'벨에어고','IMG Academy':'IMG 아카데미','American Heritage':'아메리칸 헤리티지고','Calvary Christian':'캘버리 크리스천고','Buford':'뷰퍼드고','Parkview':'파크뷰고','Hamilton':'해밀턴고','Brophy Prep':'브로피 프렙','Xaverian':'재비어리언고','Monsignor Farrell':'몬시뇰 패럴고','Lincoln-Way East':'링컨웨이 이스트고','Mount Carmel':'마운트카멜고','Archbishop Moeller':'아치비숍 묄러고','Puyallup':'퓨얄럽고','Cardinal Gibbons':'카디널 기번스고'},
  unis:['밴더빌트대','LSU','텍사스 A&M대','플로리다대','아칸소대','스탠퍼드대','UCLA','웨이크포레스트대','테네시대','오리건주립대'],
  tours:{
   wl1:{tag:'3월',title:'봄 지구 리그',when:'3~4월',host:'주 고교체육협회',place:'지구 내 구장 · 주말'},
   emart:{tag:'NHSI',title:'전미 고교 인비테이셔널',when:'4월 초',host:'NHSI',place:'노스캐롤라이나 캐리'},
   gold:{tag:'지역',title:'지역 플레이오프',when:'5월',host:'주 고교체육협회',place:'지역 개최 구장'},
   wl2:{tag:'주',title:'주 플레이오프',when:'5~6월',host:'주 고교체육협회',place:'주 내 개최 구장'},
   dragon:{tag:'PG',title:'퍼펙트게임 내셔널 쇼케이스',when:'6월',host:'퍼펙트게임',place:'애리조나 피닉스'},
   pres:{tag:'ECP',title:'이스트코스트 프로',when:'7월',host:'이스트코스트 프로',place:'앨라배마 후버'},
   phoenix:{tag:'주피터',title:'WWBA 월드 챔피언십',when:'10월',host:'퍼펙트게임',place:'플로리다 주피터'},
   nat:{tag:'에어리어',title:'에어리어 코드 게임스',when:'8월',host:'에어리어 코드 게임스',place:'캘리포니아 롱비치'}
  }
 }
 },
 NPB:{
 rule:{lg:'NPB',homeDraft:false,uniYears:4,mlbOffers:true,returnRule:'free',mil:'none',exempt:false,asian:true,
   faDom:[8,7],faAbroad:9,draftTeams:12,draftPicks:72,bonusMul:1.6,cur:'JPY',
   sal:[[40,.4],[50,.45],[55,.6],[65,2.5],[75,9],[85,30],[95,50],[99,60]]},
 data:{
  teams:[['読売ジャイアンツ',80,95,92],['阪神タイガース',82,94,84],['横浜DeNAベイスターズ',70,74,72],['広島東洋カープ',62,80,60],['東京ヤクルトスワローズ',52,64,62],['中日ドラゴンズ',50,70,64],
         ['福岡ソフトバンクホークス',90,82,96],['北海道日本ハムファイターズ',72,72,64],['オリックス・バファローズ',66,58,66],['東北楽天ゴールデンイーグルス',56,56,68],['埼玉西武ライオンズ',54,62,58],['千葉ロッテマリーンズ',60,64,60]],
  unis:['早稲田大学','慶應義塾大学','明治大学','法政大学','亜細亜大学','東洋大学','中央大学','青山学院大学','國學院大學','東北福祉大学','大阪商業大学'],
  ind:['徳島インディゴソックス','高知ファイティングドッグス','富山GRNサンダーバーズ','信濃グランセローズ','神奈川フューチャードリームス'],
  regions:['北海道','青森','岩手','宮城','東京','神奈川','埼玉','千葉','愛知','大阪','兵庫','奈良','和歌山','広島','高知','福岡','沖縄'],
  hs:{北海道:['北海','駒大苫小牧','札幌日大'],青森:['八戸学院光星','青森山田'],岩手:['花巻東','盛岡大附'],宮城:['仙台育英','東北'],
      東京:['帝京','日大三','早稲田実','関東一','二松学舎大附'],神奈川:['横浜','東海大相模','慶應義塾'],埼玉:['浦和学院','花咲徳栄'],千葉:['習志野','木更津総合','専大松戸'],
      愛知:['中京大中京','東邦','愛工大名電'],大阪:['大阪桐蔭','履正社'],兵庫:['報徳学園','明石商','東洋大姫路'],奈良:['天理','智辯学園'],和歌山:['智辯和歌山'],
      広島:['広陵'],高知:['明徳義塾'],福岡:['九州国際大付','福岡大大濠'],沖縄:['興南','沖縄尚学']},
  fav:{東京:['読売ジャイアンツ','東京ヤクルトスワローズ'],大阪:['阪神タイガース','オリックス・バファローズ'],兵庫:['阪神タイガース','オリックス・バファローズ'],宮城:['東北楽天ゴールデンイーグルス'],
       北海道:['北海道日本ハムファイターズ'],愛知:['中日ドラゴンズ'],広島:['広島東洋カープ'],神奈川:['横浜DeNAベイスターズ'],埼玉:['埼玉西武ライオンズ'],千葉:['千葉ロッテマリーンズ'],福岡:['福岡ソフトバンクホークス']}
 },
 hsTours:{
  wl1:{tag:'春',title:'春季都道府県大会',when:'3–4月',host:'各都道府県高野連',place:'都道府県内各球場'},
  emart:{tag:'センバツ',title:'選抜高等学校野球大会',nth:y=>98+(y-2026),when:'3月下旬',host:'毎日新聞社・日本高野連',place:'阪神甲子園球場'},
  gold:{tag:'地区',title:'春季地区大会',nth:null,when:'5月',host:'各地区高野連',place:'地区内の持ち回り球場'},
  wl2:{tag:'予選',title:'夏の地方大会',when:'6–7月',host:'朝日新聞社・各都道府県高野連',place:'都道府県内各球場'},
  dragon:{tag:'甲子園',title:'全国高等学校野球選手権大会',nth:y=>108+(y-2026),when:'8月',host:'朝日新聞社・日本高野連',place:'阪神甲子園球場'},
  pres:{tag:'秋',title:'秋季都道府県大会',nth:null,when:'9月',host:'各都道府県高野連',place:'都道府県内各球場'},
  phoenix:{tag:'神宮',title:'明治神宮野球大会',nth:y=>57+(y-2026),when:'11月',host:'明治神宮・日本学生野球協会',place:'明治神宮野球場'},
  nat:{tag:'国スポ',title:'国民スポーツ大会 高校野球',nth:y=>80+(y-2026),when:'10月',host:'日本スポーツ協会',place:'開催県'}
 },
 /* 한국어 화면용 이름: 화면 언어가 한국어면 setLeague()가 위 데이터 대신 이 이름을 쓴다 */
 ko:{
  names:{'読売ジャイアンツ':'요미우리 자이언츠','阪神タイガース':'한신 타이거스','横浜DeNAベイスターズ':'요코하마 DeNA 베이스타스','広島東洋カープ':'히로시마 도요 카프','東京ヤクルトスワローズ':'도쿄 야쿠르트 스왈로스','中日ドラゴンズ':'주니치 드래곤스','福岡ソフトバンクホークス':'후쿠오카 소프트뱅크 호크스','北海道日本ハムファイターズ':'홋카이도 닛폰햄 파이터스','オリックス・バファローズ':'오릭스 버펄로스','東北楽天ゴールデンイーグルス':'도호쿠 라쿠텐 골든이글스','埼玉西武ライオンズ':'사이타마 세이부 라이온스','千葉ロッテマリーンズ':'지바 롯데 마린스','徳島インディゴソックス':'도쿠시마 인디고삭스','高知ファイティングドッグス':'고치 파이팅독스','富山GRNサンダーバーズ':'도야마 GRN 선더버즈','信濃グランセローズ':'시나노 그란세로즈','神奈川フューチャードリームス':'가나가와 퓨처드림스','北海道':'홋카이도','青森':'아오모리','岩手':'이와테','宮城':'미야기','東京':'도쿄','神奈川':'가나가와','埼玉':'사이타마','千葉':'지바','愛知':'아이치','大阪':'오사카','兵庫':'효고','奈良':'나라','和歌山':'와카야마','広島':'히로시마','高知':'고치','福岡':'후쿠오카','沖縄':'오키나와','北海':'홋카이고','駒大苫小牧':'고마다이토마코마이고','札幌日大':'삿포로니치다이고','八戸学院光星':'하치노헤가쿠인코세이고','青森山田':'아오모리야마다고','花巻東':'하나마키히가시고','盛岡大附':'모리오카대부속고','仙台育英':'센다이이쿠에이고','東北':'도호쿠고','帝京':'데이쿄고','日大三':'니치다이산고','早稲田実':'와세다실업고','関東一':'간토다이이치고','二松学舎大附':'니쇼가쿠샤대부속고','横浜':'요코하마고','東海大相模':'도카이대사가미고','慶應義塾':'게이오기주쿠고','浦和学院':'우라와가쿠인고','花咲徳栄':'하나사키토쿠하루고','習志野':'나라시노고','木更津総合':'기사라즈소고고','専大松戸':'센다이마쓰도고','中京大中京':'주쿄대주쿄고','東邦':'도호고','愛工大名電':'아이코다이메이덴고','大阪桐蔭':'오사카토인고','履正社':'리세이샤고','報徳学園':'호토쿠가쿠엔고','明石商':'아카시상업고','東洋大姫路':'도요대히메지고','天理':'덴리고','智辯学園':'지벤가쿠엔고','智辯和歌山':'지벤와카야마고','広陵':'고료고','明徳義塾':'메이토쿠기주쿠고','九州国際大付':'규슈국제대부속고','福岡大大濠':'후쿠오카대오호리고','興南':'고난고','沖縄尚学':'오키나와쇼가쿠고'},
  unis:['와세다대','게이오대','메이지대','호세이대','아시아대','도요대','주오대','아오야마가쿠인대','고쿠가쿠인대','도호쿠후쿠시대','오사카상업대'],
  tours:{
   wl1:{tag:'봄',title:'춘계 도도부현 대회',when:'3~4월',host:'각 도도부현 고교야구연맹',place:'도도부현 내 각 구장'},
   emart:{tag:'센바쓰',title:'선발 고등학교 야구대회',when:'3월 하순',host:'마이니치신문사·일본고교야구연맹',place:'한신 고시엔 구장'},
   gold:{tag:'지구',title:'춘계 지구 대회',when:'5월',host:'각 지구 고교야구연맹',place:'지구 내 순회 구장'},
   wl2:{tag:'예선',title:'여름 지방 대회',when:'6~7월',host:'아사히신문사·각 도도부현 고교야구연맹',place:'도도부현 내 각 구장'},
   dragon:{tag:'고시엔',title:'전국 고등학교 야구선수권대회',when:'8월',host:'아사히신문사·일본고교야구연맹',place:'한신 고시엔 구장'},
   pres:{tag:'가을',title:'추계 도도부현 대회',when:'9월',host:'각 도도부현 고교야구연맹',place:'도도부현 내 각 구장'},
   phoenix:{tag:'진구',title:'메이지진구 야구대회',when:'11월',host:'메이지진구·일본학생야구협회',place:'메이지진구 야구장'},
   nat:{tag:'국스포',title:'국민스포츠대회 고교야구',when:'10월',host:'일본스포츠협회',place:'개최 현'}
  }
 }
 },
 CPBL:{
 rule:{lg:'CPBL',homeDraft:false,uniYears:4,mlbOffers:true,returnRule:'draft',mil:'tw',milYears:1,exempt:false,asian:true,
   faDom:[9,8],faAbroad:9,draftTeams:6,draftPicks:36,bonusMul:.35,cur:'TWD',
   sal:[[40,.16],[50,.2],[55,.3],[65,.9],[75,2.2],[85,4.5],[95,7],[99,9]]},
 data:{
  teams:[['中信兄弟',80,90,80],['統一7-ELEVEn獅',74,80,74],['樂天桃猿',66,72,72],['富邦悍將',54,66,78],['味全龍',70,70,70],['台鋼雄鷹',50,56,60]],
  unis:['國立臺灣體育運動大學','臺北市立大學','國立體育大學','輔仁大學','中國文化大學','開南大學','南華大學','國立臺東大學'],
  ind:['台北巨人','新北熊讚','台中金剛'],
  regions:['台北市','新北市','桃園市','台中市','台南市','高雄市','嘉義市','屏東縣','花蓮縣','台東縣','宜蘭縣'],
  hs:{台北市:['穀保家商','華興中學'],新北市:['鶯歌工商','北大高中'],桃園市:['平鎮高中','中壢高中'],台中市:['西苑高中','台中高農'],台南市:['南英商工','台南高商'],
      高雄市:['普門中學','三民高中','高苑工商'],嘉義市:['嘉義高中'],屏東縣:['美和中學'],花蓮縣:['花蓮體中'],台東縣:['台東體中'],宜蘭縣:['中道中學']},
  fav:{台中市:['中信兄弟'],台南市:['統一7-ELEVEn獅'],桃園市:['樂天桃猿'],新北市:['富邦悍將'],台北市:['味全龍'],高雄市:['台鋼雄鷹']}
 },
 hsTours:{
  wl1:{tag:'聯賽',title:'高中棒球運動聯賽 分區預賽',when:'3–4月',host:'中華民國高級中等學校體育總會',place:'各分區球場'},
  emart:{tag:'王貞治',title:'王貞治盃全國青棒大賽',when:'3–4月',host:'中華民國棒球協會',place:'台北天母棒球場'},
  gold:{tag:'複賽',title:'高中棒球運動聯賽 複賽',nth:null,when:'5月',host:'高中體總',place:'台中洲際棒球場'},
  wl2:{tag:'預賽',title:'全國青棒錦標賽 預賽',when:'5–6月',host:'中華民國棒球協會',place:'各縣市球場'},
  dragon:{tag:'全國',title:'全國青棒錦標賽',nth:null,when:'6–7月',host:'中華民國棒球協會',place:'台南亞太棒球場'},
  pres:{tag:'國際',title:'國際青棒邀請賽',nth:null,when:'7月',host:'中華民國棒球協會',place:'花蓮德興棒球場'},
  phoenix:{tag:'黑豹旗',title:'黑豹旗全國高中棒球大賽',nth:y=>14+(y-2026),when:'10–11月',host:'黑豹旗',place:'台南市立棒球場'},
  nat:{tag:'玉山盃',title:'玉山盃全國青棒錦標賽',nth:null,when:'10月',host:'中華民國棒球協會',place:'主辦縣市'}
 },
 /* 한국어 화면용 이름: 화면 언어가 한국어면 setLeague()가 위 데이터 대신 이 이름을 쓴다 */
 ko:{
  names:{'中信兄弟':'중신 브라더스','統一7-ELEVEn獅':'퉁이 세븐일레븐 라이온스','樂天桃猿':'라쿠텐 몽키스','富邦悍將':'푸방 가디언스','味全龍':'웨이취안 드래곤스','台鋼雄鷹':'TSG 호크스','台北巨人':'타이베이 자이언츠','新北熊讚':'신베이 베어스','台中金剛':'타이중 킹콩','台北市':'타이베이시','新北市':'신베이시','桃園市':'타오위안시','台中市':'타이중시','台南市':'타이난시','高雄市':'가오슝시','嘉義市':'자이시','屏東縣':'핑둥현','花蓮縣':'화롄현','台東縣':'타이둥현','宜蘭縣':'이란현','穀保家商':'구바오가상','華興中學':'화싱중학','鶯歌工商':'잉거공상','北大高中':'베이다고','平鎮高中':'핑전고','中壢高中':'중리고','西苑高中':'시위안고','台中高農':'타이중고농','南英商工':'난잉상공','台南高商':'타이난고상','普門中學':'푸먼중학','三民高中':'싼민고','高苑工商':'가오위안공상','嘉義高中':'자이고','美和中學':'메이허중학','花蓮體中':'화롄체육중','台東體中':'타이둥체육중','中道中學':'중다오중학'},
  unis:['국립타이완체육운동대','타이베이시립대','국립체육대','푸런대','중국문화대','카이난대','난화대','국립타이둥대'],
  tours:{
   wl1:{tag:'리그',title:'고교야구 리그 지역 예선',when:'3~4월',host:'중화민국 고급중등학교 체육총회',place:'각 지역 구장'},
   emart:{tag:'왕정치',title:'왕정치배 전국 청소년야구대회',when:'3~4월',host:'중화민국 야구협회',place:'타이베이 톈무 야구장'},
   gold:{tag:'본선',title:'고교야구 리그 본선',when:'5월',host:'고교체육총회',place:'타이중 인터콘티넨털 야구장'},
   wl2:{tag:'예선',title:'전국 청소년야구 선수권 예선',when:'5~6월',host:'중화민국 야구협회',place:'각 현·시 구장'},
   dragon:{tag:'전국',title:'전국 청소년야구 선수권대회',when:'6~7월',host:'중화민국 야구협회',place:'타이난 아태 야구장'},
   pres:{tag:'국제',title:'국제 청소년야구 초청대회',when:'7월',host:'중화민국 야구협회',place:'화롄 더싱 야구장'},
   phoenix:{tag:'흑표기',title:'흑표기 전국 고교야구대회',when:'10~11월',host:'흑표기',place:'타이난 시립 야구장'},
   nat:{tag:'위산배',title:'위산배 전국 청소년야구 선수권',when:'10월',host:'중화민국 야구협회',place:'개최 현·시'}
  }
 }
 }
};
