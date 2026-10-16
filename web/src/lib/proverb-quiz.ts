export type ProverbKind = "missing" | "meaning" | "situation";

export interface ProverbQuestion {
  id: string;
  kind: ProverbKind;
  saying: string;
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: number;
  explanation: string;
  topic: string;
}

const questions: ProverbQuestion[] = [
  {
    id: "missing-mai-sat",
    kind: "missing",
    saying: "Có công mài sắt, có ngày nên kim.",
    prompt: "Điền từ còn thiếu: Có công mài sắt, có ngày nên ____.",
    options: ["đá", "kim", "gỗ", "vải"],
    correctIndex: 1,
    explanation:
      "Câu tục ngữ khuyên ta kiên trì thì có thể làm được việc khó. Khi học bài, em hãy luyện tập từng chút và không vội bỏ cuộc.",
    topic: "Kiên trì",
  },
  {
    id: "missing-nho-nguon",
    kind: "missing",
    saying: "Uống nước nhớ nguồn.",
    prompt: "Điền từ còn thiếu: Uống nước nhớ ____.",
    options: ["sông", "biển", "mưa", "nguồn"],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ nhắc ta nhớ ơn những người đã tạo ra điều tốt đẹp mình được hưởng. Em có thể thể hiện lòng biết ơn qua lời cảm ơn và việc làm cụ thể.",
    topic: "Biết ơn",
  },
  {
    id: "missing-trong-cay",
    kind: "missing",
    saying: "Ăn quả nhớ kẻ trồng cây.",
    prompt: "Điền từ còn thiếu: Ăn quả nhớ kẻ ____ cây.",
    options: ["trồng", "ngắm", "đếm", "vẽ"],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ nhắc ta biết ơn người đã giúp mình có thành quả. Khi được giúp đỡ, em hãy trân trọng công sức ấy và biết nói lời cảm ơn.",
    topic: "Biết ơn",
  },
  {
    id: "missing-bau-bi",
    kind: "missing",
    saying: "Bầu ơi thương lấy bí cùng\nTuy rằng khác giống nhưng chung một giàn.",
    prompt:
      "Điền từ còn thiếu: Bầu ơi thương lấy bí cùng / Tuy rằng khác giống nhưng chung một ____.",
    options: ["vườn", "cây", "giàn", "lá"],
    correctIndex: 2,
    explanation:
      "Bài ca dao dùng hình ảnh bầu và bí để khuyên mọi người yêu thương, đùm bọc nhau. Dù có khác biệt, các bạn vẫn có thể cùng giúp nhau trong lớp học.",
    topic: "Yêu thương",
  },
  {
    id: "missing-nhieu-dieu",
    kind: "missing",
    saying: "Nhiễu điều phủ lấy giá gương\nNgười trong một nước phải thương nhau cùng.",
    prompt:
      "Điền từ còn thiếu: Nhiễu điều phủ lấy giá gương / Người trong một nước phải ____ nhau cùng.",
    options: ["thương", "tranh", "trách", "giận"],
    correctIndex: 0,
    explanation:
      "Bài ca dao khuyên những người cùng một nước biết yêu thương và che chở cho nhau. Em có thể bắt đầu bằng việc quan tâm đến những người đang gặp khó khăn.",
    topic: "Đùm bọc",
  },
  {
    id: "missing-ba-cay",
    kind: "missing",
    saying: "Một cây làm chẳng nên non\nBa cây chụm lại nên hòn núi cao.",
    prompt:
      "Điền từ còn thiếu: Một cây làm chẳng nên non / Ba cây ____ lại nên hòn núi cao.",
    options: ["tách", "ngả", "rụng", "chụm"],
    correctIndex: 3,
    explanation:
      "Bài ca dao đề cao sức mạnh của sự đoàn kết. Khi biết góp sức và hợp tác, cả nhóm có thể làm được việc một bạn khó làm một mình.",
    topic: "Đoàn kết",
  },
  {
    id: "missing-cong-cha",
    kind: "missing",
    saying:
      "Công cha như núi Thái Sơn\nNghĩa mẹ như nước trong nguồn chảy ra\nMột lòng thờ mẹ kính cha\nCho tròn chữ hiếu mới là đạo con.",
    prompt:
      "Điền từ còn thiếu: Công cha như núi Thái Sơn / Nghĩa mẹ như nước trong ____ chảy ra.",
    options: ["hồ", "nguồn", "ao", "giếng"],
    correctIndex: 1,
    explanation:
      "Bài ca dao ca ngợi công ơn lớn lao của cha mẹ. Kính trọng, quan tâm và giúp đỡ cha mẹ là những cách thể hiện lòng hiếu thảo.",
    topic: "Gia đình",
  },
  {
    id: "missing-lua-loi",
    kind: "missing",
    saying: "Lời nói chẳng mất tiền mua\nLựa lời mà nói cho vừa lòng nhau.",
    prompt:
      "Điền từ còn thiếu: Lời nói chẳng mất tiền mua / ____ lời mà nói cho vừa lòng nhau.",
    options: ["Bỏ", "Quên", "Lựa", "Giấu"],
    correctIndex: 2,
    explanation:
      "Bài ca dao khuyên ta chọn cách nói lịch sự, tôn trọng người nghe. Nói lời dễ nghe vẫn cần đi cùng sự chân thật.",
    topic: "Lời nói đẹp",
  },
  {
    id: "missing-sang-khon",
    kind: "missing",
    saying: "Đi một ngày đàng, học một sàng khôn.",
    prompt: "Điền từ còn thiếu: Đi một ngày đàng, học một ____ khôn.",
    options: ["sàng", "túi", "bát", "rổ"],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ cho thấy trải nghiệm và quan sát giúp ta hiểu biết thêm. Khi khám phá điều mới, em hãy chú ý, đặt câu hỏi và lắng nghe.",
    topic: "Ham học hỏi",
  },
  {
    id: "missing-thuong-than",
    kind: "missing",
    saying: "Thương người như thể thương thân.",
    prompt: "Điền từ còn thiếu: Thương người như thể thương ____.",
    options: ["nhà", "cây", "hoa", "thân"],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ khuyên ta yêu thương người khác như yêu thương chính mình. Em hãy thử nghĩ đến cảm xúc của bạn để biết quan tâm và giúp đỡ phù hợp.",
    topic: "Yêu thương",
  },
  {
    id: "meaning-la-lanh",
    kind: "meaning",
    saying: "Lá lành đùm lá rách.",
    prompt: "Câu tục ngữ “Lá lành đùm lá rách” khuyên chúng ta điều gì?",
    options: [
      "Chỉ chơi với những bạn có hoàn cảnh giống mình.",
      "Chỉ giúp người khác khi được nhận quà.",
      "Biết chia sẻ, giúp đỡ người gặp khó khăn.",
      "Để người gặp khó khăn tự lo mọi việc.",
    ],
    correctIndex: 2,
    explanation:
      "Hình ảnh lá lành che chở lá rách nói về sự đùm bọc giữa con người. Ai cũng có thể giúp người khác bằng việc làm vừa sức của mình.",
    topic: "Đùm bọc",
  },
  {
    id: "meaning-hoc-ban",
    kind: "meaning",
    saying: "Học thầy không tày học bạn.",
    prompt: "Em nên hiểu câu “Học thầy không tày học bạn” như thế nào?",
    options: [
      "Ngoài học thầy cô, em còn nên học điều hay từ bạn.",
      "Em chỉ cần học bạn và không cần nghe thầy cô.",
      "Em nên chép bài của bạn để làm bài nhanh hơn.",
      "Bạn bè luôn đúng trong tất cả mọi chuyện.",
    ],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ nhấn mạnh ích lợi của việc học hỏi bạn bè. Học bạn bổ sung cho việc học thầy cô, chứ không có nghĩa là xem nhẹ thầy cô.",
    topic: "Ham học hỏi",
  },
  {
    id: "meaning-tot-go",
    kind: "meaning",
    saying: "Tốt gỗ hơn tốt nước sơn.",
    prompt: "Câu “Tốt gỗ hơn tốt nước sơn” đề cao điều gì?",
    options: [
      "Đồ vật càng nhiều màu thì càng có giá trị.",
      "Quần áo đẹp quan trọng hơn cách cư xử.",
      "Chỉ cần vẻ ngoài đẹp là đủ.",
      "Phẩm chất và giá trị bên trong quan trọng hơn vẻ ngoài.",
    ],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ khuyên ta coi trọng phẩm chất và giá trị thật. Khi kết bạn, em nên quý sự chân thành, tử tế hơn quần áo hay đồ dùng đắt tiền.",
    topic: "Phẩm chất tốt",
  },
  {
    id: "meaning-doi-sach",
    kind: "meaning",
    saying: "Đói cho sạch, rách cho thơm.",
    prompt: "Ý nghĩa chính của câu “Đói cho sạch, rách cho thơm” là gì?",
    options: [
      "Chỉ cần giữ quần áo sạch, không cần giữ lời hứa.",
      "Dù khó khăn vẫn giữ lòng tự trọng và sống ngay thẳng.",
      "Có thể làm điều sai nếu mình đang thiếu thốn.",
      "Người có ít đồ dùng thì không thể giúp ai.",
    ],
    correctIndex: 1,
    explanation:
      "“Sạch” và “thơm” trong câu tục ngữ còn chỉ phẩm chất tốt đẹp. Dù hoàn cảnh khó khăn, ta vẫn cần sống trung thực và giữ lòng tự trọng.",
    topic: "Trung thực",
  },
  {
    id: "meaning-gan-den",
    kind: "meaning",
    saying: "Gần mực thì đen, gần đèn thì sáng.",
    prompt: "Câu “Gần mực thì đen, gần đèn thì sáng” nhắc em điều gì?",
    options: [
      "Biết học điều tốt và tránh làm theo thói quen xấu.",
      "Cứ đứng gần đèn là tự nhiên học giỏi.",
      "Không nên chơi với bạn thích vẽ bằng mực.",
      "Mọi việc bạn bè làm đều nên bắt chước.",
    ],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ nói về ảnh hưởng của môi trường và những người quanh ta. Em vẫn có thể chủ động chọn việc đúng và góp ý để cùng bạn tiến bộ.",
    topic: "Học điều hay",
  },
  {
    id: "meaning-mieng-khi-doi",
    kind: "meaning",
    saying: "Một miếng khi đói bằng một gói khi no.",
    prompt: "Câu “Một miếng khi đói bằng một gói khi no” đề cao điều gì?",
    options: [
      "Vì món ăn nhỏ lúc nào cũng ngon hơn món ăn lớn.",
      "Vì chỉ nên giúp người khác sau khi họ hết khó khăn.",
      "Vì sự giúp đỡ đúng lúc cần thiết rất đáng quý.",
      "Vì quà càng đắt thì tình cảm càng nhiều.",
    ],
    correctIndex: 2,
    explanation:
      "Sự giúp đỡ kịp lúc có thể đem lại giá trị rất lớn cho người đang cần. Một việc nhỏ, như cho bạn mượn bút khi bút hỏng, cũng đáng trân trọng.",
    topic: "Giúp đúng lúc",
  },
  {
    id: "meaning-tay-cheo",
    kind: "meaning",
    saying: "Chớ thấy sóng cả mà ngã tay chèo.",
    prompt: "Câu “Chớ thấy sóng cả mà ngã tay chèo” khuyên ta làm gì?",
    options: [
      "Bỏ dở mọi việc ngay khi gặp khó.",
      "Chỉ nhận làm những việc thật dễ.",
      "Cố làm một mình và không được hỏi ai.",
      "Giữ quyết tâm, tìm cách vượt qua khó khăn.",
    ],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ dùng hình ảnh chèo thuyền để khuyên ta không nản lòng trước thử thách. Quyết tâm còn có thể đi cùng việc tìm cách mới hoặc nhờ người hướng dẫn.",
    topic: "Vượt khó",
  },
  {
    id: "meaning-co-chi",
    kind: "meaning",
    saying: "Có chí thì nên.",
    prompt: "“Có chí thì nên” có ý nghĩa gần nhất với lời khuyên nào?",
    options: [
      "Chỉ cần ước là mọi việc tự thành công.",
      "Có quyết tâm và bền bỉ cố gắng thì có thể đạt mục tiêu.",
      "Làm một lần chưa được thì nên dừng hẳn.",
      "Muốn thành công thì không cần luyện tập.",
    ],
    correctIndex: 1,
    explanation:
      "Câu tục ngữ đề cao ý chí và sự cố gắng bền bỉ. Mục tiêu vừa sức cùng việc luyện tập đều đặn giúp em từng bước tiến bộ.",
    topic: "Kiên trì",
  },
  {
    id: "meaning-ngua-dau",
    kind: "meaning",
    saying: "Một con ngựa đau, cả tàu bỏ cỏ.",
    prompt: "Câu “Một con ngựa đau, cả tàu bỏ cỏ” nói về tình cảm nào?",
    options: [
      "Sự thờ ơ khi người khác gặp chuyện buồn.",
      "Sự ganh đua để được phần hơn.",
      "Sự quan tâm, chia sẻ khi một thành viên gặp khó khăn.",
      "Sự vui mừng khi bạn bị điểm thấp.",
    ],
    correctIndex: 2,
    explanation:
      "Câu tục ngữ nói về tình gắn bó và sự chia sẻ trong một tập thể. Ở đây, “tàu” là nơi ngựa ăn, không phải tàu thuyền.",
    topic: "Quan tâm",
  },
  {
    id: "meaning-chi-nga",
    kind: "meaning",
    saying: "Chị ngã em nâng.",
    prompt: "Bài học từ câu “Chị ngã em nâng” là gì?",
    options: [
      "Anh chị em biết yêu thương, giúp đỡ nhau lúc khó khăn.",
      "Chỉ người lớn mới có thể giúp người nhỏ.",
      "Thấy người thân gặp khó thì nên đứng nhìn.",
      "Chỉ giúp đỡ khi được người khác khen.",
    ],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ khuyên anh chị em nâng đỡ, đùm bọc nhau. Người nhỏ tuổi cũng có thể quan tâm và giúp người lớn bằng việc vừa sức.",
    topic: "Gia đình",
  },
  {
    id: "situation-kien-tha",
    kind: "situation",
    saying: "Kiến tha lâu cũng đầy tổ.",
    prompt:
      "Mỗi ngày, An đọc thêm vài trang sách và ghi lại từ mới nên dần đọc tốt hơn; câu tục ngữ nào phù hợp nhất?",
    options: [
      "Tốt gỗ hơn tốt nước sơn.",
      "Kiến tha lâu cũng đầy tổ.",
      "Lời chào cao hơn mâm cỗ.",
      "Bán anh em xa, mua láng giềng gần.",
    ],
    correctIndex: 1,
    explanation:
      "Câu tục ngữ nói về kết quả của sự chăm chỉ tích lũy từng chút. Một thói quen học tập nhỏ nhưng đều đặn sẽ giúp em tiến bộ theo thời gian.",
    topic: "Chăm học",
  },
  {
    id: "situation-nho-thay",
    kind: "situation",
    saying: "Không thầy đố mày làm nên.",
    prompt:
      "Nhờ cô kiên nhẫn hướng dẫn, Bình hiểu cách chia số và biết ơn cô; câu tục ngữ nào phù hợp nhất?",
    options: [
      "Tấc đất tấc vàng.",
      "Góp gió thành bão.",
      "Chị ngã em nâng.",
      "Không thầy đố mày làm nên.",
    ],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ nhấn mạnh vai trò dạy dỗ, hướng dẫn của người thầy. Biết ơn thầy cô đi cùng sự chủ động học hỏi và cố gắng của chính em.",
    topic: "Kính trọng thầy cô",
  },
  {
    id: "situation-tay-chan",
    kind: "situation",
    saying: "Anh em như thể tay chân\nRách lành đùm bọc, dở hay đỡ đần.",
    prompt:
      "Thấy em trai mệt, chị Mai giúp em chuẩn bị cặp sách và nhắc em nghỉ ngơi; câu nào phù hợp nhất?",
    options: [
      "Anh em như thể tay chân / Rách lành đùm bọc, dở hay đỡ đần.",
      "Đi một ngày đàng, học một sàng khôn.",
      "Gần mực thì đen, gần đèn thì sáng.",
      "Có công mài sắt, có ngày nên kim.",
    ],
    correctIndex: 0,
    explanation:
      "Bài ca dao ví anh em gắn bó như tay với chân của một cơ thể. Người trong gia đình cần yêu thương, đỡ đần nhau cả lúc vui lẫn khi gặp khó.",
    topic: "Gia đình",
  },
  {
    id: "situation-lang-gieng",
    kind: "situation",
    saying: "Bán anh em xa, mua láng giềng gần.",
    prompt:
      "Khi nhà Lan bị mất điện buổi tối, bác hàng xóm cho mượn đèn và giúp kiểm tra an toàn; câu nào nhắc đến tình làng xóm?",
    options: [
      "Có chí thì nên.",
      "Tốt gỗ hơn tốt nước sơn.",
      "Bán anh em xa, mua láng giềng gần.",
      "Ăn quả nhớ kẻ trồng cây.",
    ],
    correctIndex: 2,
    explanation:
      "Câu tục ngữ khuyên ta xây dựng tình cảm tốt với hàng xóm để giúp đỡ nhau khi cần. Các từ “bán” và “mua” là cách nói hình ảnh, không phải bỏ người thân để đổi lấy hàng xóm.",
    topic: "Tình làng xóm",
  },
  {
    id: "situation-gop-gio",
    kind: "situation",
    saying: "Góp gió thành bão.",
    prompt:
      "Mỗi bạn tặng một cuốn sách phù hợp, cả lớp dần có một góc đọc phong phú; câu tục ngữ nào phù hợp nhất?",
    options: [
      "Lời nói gói vàng.",
      "Đói cho sạch, rách cho thơm.",
      "Không thầy đố mày làm nên.",
      "Góp gió thành bão.",
    ],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ nói về việc gộp nhiều đóng góp nhỏ để tạo nên kết quả lớn. Trong tình huống này, mỗi cuốn sách góp lại giúp cả lớp có thêm cơ hội đọc.",
    topic: "Cùng đóng góp",
  },
  {
    id: "situation-loi-chao",
    kind: "situation",
    saying: "Lời chào cao hơn mâm cỗ.",
    prompt:
      "Khách đến nhà, Huy vui vẻ khoanh tay chào và mời khách ngồi; câu tục ngữ nào phù hợp nhất?",
    options: [
      "Một cây làm chẳng nên non / Ba cây chụm lại nên hòn núi cao.",
      "Lời chào cao hơn mâm cỗ.",
      "Thua keo này, bày keo khác.",
      "Kiến tha lâu cũng đầy tổ.",
    ],
    correctIndex: 1,
    explanation:
      "Câu tục ngữ coi trọng lời chào và thái độ lễ phép, chân thành. Sự tôn trọng làm người được chào thấy ấm áp hơn cả việc tiếp đãi nhiều món ngon.",
    topic: "Lễ phép",
  },
  {
    id: "situation-sai-mot-li",
    kind: "situation",
    saying: "Sai một li, đi một dặm.",
    prompt:
      "Làm toán, Vy chép nhầm một chữ số nên các bước sau cho kết quả sai; câu tục ngữ nào nhắc Vy cần cẩn thận từ đầu?",
    options: [
      "Sai một li, đi một dặm.",
      "Uống nước nhớ nguồn.",
      "Một con ngựa đau, cả tàu bỏ cỏ.",
      "Thương người như thể thương thân.",
    ],
    correctIndex: 0,
    explanation:
      "Câu tục ngữ nhắc rằng một sai sót nhỏ lúc đầu có thể dẫn đến kết quả lệch xa. Em nên kiểm tra từng bước và sửa lỗi ngay khi nhận ra.",
    topic: "Cẩn thận",
  },
  {
    id: "situation-thua-keo",
    kind: "situation",
    saying: "Thua keo này, bày keo khác.",
    prompt:
      "Chưa thắng trong lần thi kể chuyện, Nam nghe góp ý, luyện thêm và đăng ký lần sau; câu tục ngữ nào phù hợp nhất?",
    options: [
      "Lá lành đùm lá rách.",
      "Chị ngã em nâng.",
      "Thua keo này, bày keo khác.",
      "Tấc đất tấc vàng.",
    ],
    correctIndex: 2,
    explanation:
      "Câu tục ngữ khuyên ta không nản lòng sau một lần chưa thành công. Rút kinh nghiệm và chuẩn bị tốt hơn sẽ giúp em có cơ hội tiến bộ.",
    topic: "Thử lại",
  },
  {
    id: "situation-goi-vang",
    kind: "situation",
    saying: "Lời nói gói vàng.",
    prompt:
      "Thấy bạn buồn vì làm bài chưa tốt, Hà nói lời động viên chân thành khiến bạn tự tin luyện tập tiếp; câu nào đề cao giá trị lời nói?",
    options: [
      "Có công mài sắt, có ngày nên kim.",
      "Lời nói gói vàng.",
      "Ăn quả nhớ kẻ trồng cây.",
      "Đi một ngày đàng, học một sàng khôn.",
    ],
    correctIndex: 1,
    explanation:
      "Câu tục ngữ ví lời nói có giá trị như vàng. Lời nói đúng lúc, chân thành và tử tế có thể an ủi, giúp đỡ người khác.",
    topic: "Lời nói đẹp",
  },
  {
    id: "situation-tac-dat",
    kind: "situation",
    saying: "Tấc đất tấc vàng.",
    prompt:
      "Các bạn chăm sóc luống rau của trường, giữ đất sạch và không giẫm lên cây; câu nào nhắc ta quý trọng đất đai?",
    options: [
      "Học thầy không tày học bạn.",
      "Một miếng khi đói bằng một gói khi no.",
      "Chớ thấy sóng cả mà ngã tay chèo.",
      "Tấc đất tấc vàng.",
    ],
    correctIndex: 3,
    explanation:
      "Câu tục ngữ nhấn mạnh đất đai rất quý vì giúp con người trồng trọt và sinh sống. Chăm sóc đất, sử dụng hợp lý và không làm ô nhiễm là những cách trân trọng nguồn tài nguyên này.",
    topic: "Quý trọng thiên nhiên",
  },
];

/** Public-domain Vietnamese sayings; punctuation follows the reading version here. */
export const proverbQuestions: readonly ProverbQuestion[] = Object.freeze(
  questions.map((question) =>
    Object.freeze({
      ...question,
      options: Object.freeze(question.options),
    }),
  ),
);

interface ProverbRoundOptions {
  kind?: ProverbKind | "all";
  size?: number;
  random?: () => number;
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("random must return a finite number from 0 up to, but not including, 1");
    }
    const otherIndex = Math.floor(value * (index + 1));
    [shuffled[index], shuffled[otherIndex]] = [
      shuffled[otherIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

/** Call when a learner starts a round; importing the question bank uses no randomness. */
export function createProverbRound({
  kind = "all",
  size = 5,
  random = Math.random,
}: ProverbRoundOptions = {}): ProverbQuestion[] {
  if (!["all", "missing", "meaning", "situation"].includes(kind)) {
    throw new RangeError("Unknown proverb question kind");
  }
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new RangeError("Round size must be a non-negative safe integer");
  }
  if (typeof random !== "function") {
    throw new TypeError("random must be a function");
  }
  if (size === 0) return [];

  const pool = proverbQuestions.filter(
    (question) => kind === "all" || question.kind === kind,
  );
  return shuffle(pool, random)
    .slice(0, Math.min(size, pool.length))
    .map((question) => {
      const options = shuffle(
        question.options.map((text, index) => ({
          text,
          correct: index === question.correctIndex,
        })),
        random,
      );
      return {
        ...question,
        options: options.map((option) => option.text) as [
          string,
          string,
          string,
          string,
        ],
        correctIndex: options.findIndex((option) => option.correct),
      };
    });
}
