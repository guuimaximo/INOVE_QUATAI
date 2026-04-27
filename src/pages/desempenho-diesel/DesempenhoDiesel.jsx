// src/pages/DesempenhoDiesel.jsx
// ✅ Ajustado: NÃO exibe abas na page. Agora é só uma “capa” do módulo.
// A navegação passa a ser pelo Sidebar (ex.: Lançamento / Acompanhamento / etc.)

export default function DesempenhoDiesel() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Desempenho Diesel</h1>
        <p className="text-gray-600 mt-1">
          Selecione uma opção no menu à esquerda para acessar o módulo (ex.: Lançamento).
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        <div className="text-lg font-semibold mb-2">Módulo em construção</div>
        <div className="text-gray-700">
          Esta tela é apenas o acesso principal do módulo. As páginas funcionais ficam no menu lateral.
        </div>
      </div>
    </div>
  );
}
