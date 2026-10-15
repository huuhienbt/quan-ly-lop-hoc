import Image from "next/image";

export function ClassroomIllustration() {
  return (
    <div className="classroom-art playful-school-art">
      <span className="school-art-star star-one" aria-hidden="true">★</span>
      <span className="school-art-star star-two" aria-hidden="true">✦</span>
      <div className="school-art-frame">
        <Image
          src="/images/happy-school-3d.webp"
          alt="Các bạn nhỏ vui vẻ bên xe buýt xanh và ngôi trường đầy màu sắc"
          width={1536}
          height={1024}
          sizes="(max-width: 760px) 94vw, (max-width: 1200px) 55vw, 660px"
          preload
          className="school-scene-image"
        />
      </div>
      <div className="art-school-label"><span aria-hidden="true">★</span> Cùng nhau lớn lên</div>
      <div className="art-note"><span className="tiny-star" aria-hidden="true">✦</span><span>Mỗi ngày đến lớp,<br /><strong>một ngày vui!</strong></span></div>
    </div>
  );
}
