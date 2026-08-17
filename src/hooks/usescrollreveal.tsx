import { useEffect, useRef, useState } from 'react';

/**
 * Hook simples de "scroll reveal": retorna um ref pra colocar no elemento
 * e um booleano `visivel` que vira true assim que o elemento entra na tela.
 * Reaproveitável em qualquer section do site (Sobre Nós, Produtos, etc.)
 *
 * Uso:
 *   const { ref, visivel } = useScrollReveal();
 *   <section ref={ref} className={visivel ? 'opacity-100' : 'opacity-0'}>
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options?: IntersectionObserverInit
) {
  const ref = useRef<T | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisivel(true);
          observer.unobserve(elemento);
        }
      },
      { threshold: 0.15, ...options }
    );

    observer.observe(elemento);
    return () => observer.disconnect();
  }, [options]);

  return { ref, visivel };
}