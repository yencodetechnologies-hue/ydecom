import { useEffect, useState } from 'react';
import { Leaf, Salad, Truck } from 'lucide-react';
import { bannersApi } from '../../api';
import { getImageUrl } from '../../utils/helpers';

const fallbackSlides = [
  {
    id: 1,
    icon: Leaf,
    eyebrow: 'Brand Tagline',
    title: 'Fresh & Healthy Vegetable',
    cta: 'Order Now',
    from: 'from-home-forest',
    to: 'to-home-leaf',
  },
  {
    id: 2,
    icon: Truck,
    eyebrow: '50% OFF',
    title: 'Fresh Vegetable Free Home Delivery',
    cta: 'Order Now',
    from: 'from-home-leaf',
    to: 'to-home-mint',
  },
  {
    id: 3,
    icon: Salad,
    eyebrow: '100% Organic',
    title: 'Eat Healthy Eat Organic',
    cta: 'Shop Now',
    from: 'from-home-mint',
    to: 'to-home-sand',
    dark: true,
  },
];

export default function HeroCarousel() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let active2 = true;
    bannersApi
      .listPublic()
      .then((res) => {
        if (active2) setBanners(res.data?.data || []);
      })
      .catch(() => {
        if (active2) setBanners([]);
      })
      .finally(() => {
        if (active2) setLoading(false);
      });
    return () => {
      active2 = false;
    };
  }, []);

  const hasBanners = banners.length > 0;
  const slideCount = hasBanners ? banners.length : fallbackSlides.length;

  useEffect(() => {
    if (slideCount <= 1) return undefined;
    const id = setInterval(() => setActive((v) => (v + 1) % slideCount), 4500);
    return () => clearInterval(id);
  }, [slideCount]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
        <div className="h-64 w-full animate-pulse rounded-2xl bg-home-sand sm:h-80" />
      </section>
    );
  }

  if (hasBanners) {
    return (
      <section className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl shadow-sm sm:h-80">
          {banners.map((banner, i) => {
            const image = (
              <img
                src={getImageUrl(banner.image)}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  i === active ? 'opacity-100' : 'opacity-0'
                }`}
              />
            );
            return banner.link ? (
              <a key={banner._id} href={banner.link} className="absolute inset-0">
                {image}
              </a>
            ) : (
              <div key={banner._id} className="absolute inset-0">
                {image}
              </div>
            );
          })}
        </div>

        {banners.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2">
            {banners.map((banner, i) => (
              <button
                key={banner._id}
                type="button"
                aria-label={`Go to banner ${i + 1}`}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all ${
                  i === active ? 'w-6 bg-home-leaf' : 'w-2 bg-home-mint/60'
                }`}
              />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {fallbackSlides.map((slide, i) => {
          const Icon = slide.icon;
          const isActive = i === active;
          return (
            <div
              key={slide.id}
              className={`relative flex h-64 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-sm transition-all duration-500 ${slide.from} ${slide.to} ${
                isActive ? 'ring-2 ring-home-leaf ring-offset-2' : 'opacity-90'
              }`}
            >
              <Icon
                className={`absolute -bottom-6 -right-6 h-36 w-36 ${
                  slide.dark ? 'text-home-forest/10' : 'text-white/15'
                }`}
              />
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  slide.dark ? 'bg-home-forest/10 text-home-forest' : 'bg-white/20 text-white'
                }`}
              >
                {slide.eyebrow}
              </span>
              <div className="relative z-10">
                <h2
                  className={`font-display text-2xl font-bold leading-tight sm:text-3xl ${
                    slide.dark ? 'text-home-forest' : 'text-white'
                  }`}
                >
                  {slide.title}
                </h2>
                <button
                  type="button"
                  className={`mt-4 rounded-full px-5 py-2 text-sm font-semibold shadow ${
                    slide.dark
                      ? 'bg-home-forest text-white'
                      : 'bg-white text-home-forest'
                  }`}
                >
                  {slide.cta}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {fallbackSlides.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-2 rounded-full transition-all ${
              i === active ? 'w-6 bg-home-leaf' : 'w-2 bg-home-mint/60'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
