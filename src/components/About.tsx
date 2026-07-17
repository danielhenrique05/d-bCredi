import React from 'react';
import { CheckCircle2, HeartHandshake, MessageCircle, Target, UsersRound } from 'lucide-react';

const valores = [
  'Honestidade',
  'Transparência',
  'Compromisso',
  'Respeito',
  'Excelência no atendimento',
  'Valorização das pessoas',
  'Crescimento sustentável',
  'Fé, trabalho e dedicação',
];

const About: React.FC = () => {
  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Sobre a d&b Credi</p>
          <h2 className="mb-4 text-4xl font-bold text-gray-800">Crédito com propósito, confiança e proximidade</h2>
          <p className="text-xl text-gray-600">O crédito que você precisa para transformar planos em conquistas.</p>
        </div>

        <div className="mb-20 grid items-center gap-12 lg:grid-cols-2">
          <img
            src="https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1000&h=700&fit=crop"
            alt="Atendimento próximo e humano da d&b Credi"
            className="h-full min-h-[360px] w-full rounded-3xl object-cover shadow-lg"
          />
          <div>
            <h3 className="mb-6 text-3xl font-bold text-gray-800">Nossa História</h3>
            <p className="mb-5 text-lg leading-relaxed text-gray-600">
              A d&b Credi nasceu do sonho e da determinação de Vera e Gentil Bonêz em oferecer soluções financeiras com atendimento próximo, humano e transparente.
            </p>
            <p className="mb-5 text-lg leading-relaxed text-gray-600">
              Ao longo desses 9 anos, ajudamos centenas de famílias, empreendedores, agricultores e investidores a conquistarem seus objetivos através do crédito consciente e do consórcio planejado.
            </p>
            <p className="text-lg leading-relaxed text-gray-600">
              Mais do que operações financeiras, construímos relacionamentos baseados na confiança, credibilidade e compromisso com os resultados dos nossos clientes.
            </p>
          </div>
        </div>

        <div className="mb-16 grid gap-8 lg:grid-cols-2">
          <article className="rounded-2xl bg-white p-8 shadow-md">
            <Target className="mb-5 h-12 w-12 text-blue-600" />
            <h3 className="mb-3 text-2xl font-bold text-gray-800">Missão</h3>
            <p className="leading-relaxed text-gray-600">
              Transformar sonhos em conquistas por meio de soluções financeiras inteligentes, seguras e acessíveis.
            </p>
          </article>
          <article className="rounded-2xl bg-white p-8 shadow-md">
            <UsersRound className="mb-5 h-12 w-12 text-yellow-500" />
            <h3 className="mb-3 text-2xl font-bold text-gray-800">Visão</h3>
            <p className="leading-relaxed text-gray-600">
              Ser a empresa mais lembrada da região quando o assunto for planejamento financeiro, crédito e consórcios, construindo relacionamentos duradouros baseados na confiança.
            </p>
          </article>
        </div>

        <div className="mb-16 rounded-3xl bg-blue-700 p-8 text-white shadow-xl lg:p-12">
          <div className="mb-8 flex items-center gap-4">
            <HeartHandshake className="h-11 w-11 text-yellow-300" />
            <div>
              <h3 className="text-3xl font-bold">Nossos Valores</h3>
              <p className="mt-1 text-blue-100">A base de cada atendimento e relacionamento que construímos.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {valores.map((valor) => (
              <div key={valor} className="flex items-center gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-yellow-300" />
                <span className="font-medium">{valor}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-sm">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 text-green-600" />
          <h3 className="mb-3 text-2xl font-bold text-gray-800">Vamos conversar?</h3>
          <p className="mb-6 text-gray-600">Conte com a d&b Credi para planejar seu próximo passo com segurança.</p>
          <a
            href="https://wa.me/554999103430"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-green-700"
          >
            <MessageCircle className="h-5 w-5" /> WhatsApp +55 49 9910-3430
          </a>
        </div>
      </div>
    </section>
  );
};

export default About;
