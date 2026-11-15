import { slugify } from './slug';

describe('slugify', () => {
  it('транслитерирует кириллицу и склеивает слова дефисом', () => {
    expect(slugify('Чай и не кофе')).toBe('chay-i-ne-kofe');
    expect(slugify('Эспрессо и классика')).toBe('espresso-i-klassika');
  });

  it('убирает знаки и лишние дефисы по краям', () => {
    expect(slugify('  Десерты!!! ')).toBe('deserty');
    expect(slugify('V60 / Аэропресс')).toBe('v60-aeropress');
  });

  it('понимает казахские буквы', () => {
    expect(slugify('Қазақ кофесі')).toBe('qazaq-kofesi');
  });

  it('из одних знаков делает запасной slug', () => {
    expect(slugify('☕️')).toBe('category');
  });
});
