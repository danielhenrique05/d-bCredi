const API_URL = 'https://fragaebitelloconsorcios.com.br/api/json/contemplados';

export default async function handler(): Promise<Response> {
  try {
    const resposta = await fetch(API_URL);

    return new Response(resposta.body, {
      status: resposta.status,
      headers: {
        'Content-Type': resposta.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return Response.json(
      { erro: 'Não foi possível consultar a API de cartas contempladas.' },
      { status: 502 },
    );
  }
}
