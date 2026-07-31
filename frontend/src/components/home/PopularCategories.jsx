import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  ChefHat,
  Coffee,
  CupSoda,
  Fish,
  HeartPulse,
  ShoppingBasket,
  Sparkles,
  SprayCan,
} from 'lucide-react';
import { categoriesApi } from '../../api';
import { getImageUrl } from '../../utils/helpers';

const iconRules = [
  [/fruit|vegetable|produce/i, Apple],
  [/meat|fish|seafood/i, Fish],
  [/breakfast/i, Coffee],
  [/beverage|drink/i, CupSoda],
  [/health/i, HeartPulse],
  [/clean/i, SprayCan],
  [/personal|beauty|care/i, Sparkles],
  [/cook|kitchen/i, ChefHat],
];

const iconFor = (name) => iconRules.find(([re]) => re.test(name))?.[1] || ShoppingBasket;

export default function PopularCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    categoriesApi
      .listPublic()
      .then((res) => {
        if (active) setCategories(res.data?.data || []);
      })
      .catch(() => {
        if (active) setCategories([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loading && categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
      <h2 className="mb-6 font-display text-xl font-bold text-home-forest sm:text-2xl">
        Popular Categories
      </h2>

      <div className="flex flex-wrap gap-x-6 gap-y-8">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex w-24 flex-col items-center gap-3">
                <span className="h-24 w-24 animate-pulse rounded-full bg-home-mint/30" />
                <span className="h-4 w-16 animate-pulse rounded bg-home-mint/30" />
              </div>
            ))
          : categories.map((cat) => {
              const Icon = iconFor(cat.name);
              const imageUrl = getImageUrl(cat.image);
              return (
                <Link
                  key={cat._id}
                  to={`/shop?category=${cat._id}`}
                  className="group flex w-24 flex-col items-center gap-3 text-center"
                >
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-home-mint/40 ring-1 ring-home-leaf/25 transition group-hover:bg-home-mint/60 group-hover:ring-home-leaf">
                    {imageUrl ? (
                      <img src={imageUrl} alt={cat.name} className="h-full w-full object-cover" />
                    ) : (
                      <Icon className="h-9 w-9 text-home-leaf" strokeWidth={1.6} />
                    )}
                  </span>
                  <span className="text-sm font-semibold leading-snug text-home-forest/85">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
