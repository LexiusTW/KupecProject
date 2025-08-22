'use client';

import Image from 'next/image';

export default function CategorySection() {
  const categories = [
    {
      id: 1,
      title: 'Сортовой прокат',
      description: 'Арматура, круг, квадрат, шестигранник, полоса, катанка',
      image: '/images/categories/sortovoy.jpg',
    },
    {
      id: 2,
      title: 'Фасонный прокат',
      description: 'Уголки, швеллеры, двутавры, тавры, Z-образный профиль',
      image: '/images/categories/phasonniy.png',
    },
    {
      id: 3,
      title: 'Трубный прокат',
      description: 'Трубы круглые, профильные, электросварные и бесшовные',
      image: '/images/categories/trubniy.jpg',
    },
    {
      id: 4,
      title: 'Листовой прокат',
      description: 'Холоднокатаный, горячекатаный, оцинкованный, рифлёный лист',
      image: '/images/categories/listovoy.jpg',
    },
    {
      id: 5,
      title: 'Художественный прокат',
      description: 'Кованные изделия, декоративные элементы, узоры и литьё',
      image: '/images/categories/hudozhestveniy.jpg',
    },
    {
      id: 6,
      title: 'Специальные виды проката',
      description: 'Нестандартные профили, заказные сечения, сложные формы',
      image: '/images/categories/spec.jpg',
    },
  ];

  return (
    <section id="categories" className="mb-16">
      <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
        Категории продукции
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden group"
          >
            <div className="relative h-48 overflow-hidden">
              <Image
                src={category.image}
                alt={category.title}
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                fill
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {category.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {category.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
