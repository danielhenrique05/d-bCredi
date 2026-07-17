import React, { useState } from 'react';
import { MessageCircle, Phone, Send } from 'lucide-react';

const WHATSAPP_NUMBER = '554999103430';

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = [
      `Olá! Meu nome é ${formData.name}.`,
      formData.phone ? `Meu telefone é ${formData.phone}.` : '',
      formData.subject ? `Assunto: ${formData.subject}.` : '',
      formData.message,
    ]
      .filter(Boolean)
      .join('\n');

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <section className="bg-gray-50 py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-800">Entre em Contato</h2>
          <p className="text-xl text-gray-600">Conte com a d&b Credi para planejar sua próxima conquista.</p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
          <div className="rounded-2xl bg-blue-700 p-8 text-white shadow-lg">
            <MessageCircle className="mb-6 h-12 w-12 text-yellow-300" />
            <h3 className="mb-4 text-3xl font-bold">Atendimento pelo WhatsApp</h3>
            <p className="mb-8 leading-relaxed text-blue-100">
              Nossa equipe está pronta para entender seus objetivos e ajudar a encontrar uma solução financeira segura e acessível.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-3 font-semibold text-blue-900 transition-colors hover:bg-yellow-300"
            >
              <Phone className="h-5 w-5" /> +55 49 9910-3430
            </a>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-lg">
            <h3 className="mb-6 text-2xl font-bold text-gray-800">Envie sua mensagem</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Nome</span>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Telefone</span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => setFormData((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Assunto</span>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Mensagem</span>
                <textarea
                  rows={5}
                  required
                  value={formData.message}
                  onChange={(event) => setFormData((current) => ({ ...current, message: event.target.value }))}
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700">
                <Send className="h-5 w-5" /> Abrir conversa no WhatsApp
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
