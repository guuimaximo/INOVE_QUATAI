import React from "react";
import Sidebar from "../../components/Sidebar";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  const cards = [
    {
      title: "Tratativas de Comportamento",
      desc: "Gerencie e acompanhe tratativas de motoristas e ocorrências operacionais.",
      color: "from-blue-500 to-blue-700",
      path: "/central",
    },
    {
      title: "Cobrança de Avarias",
      desc: "Controle e registre avarias lançadas pela manutenção e cobradas pela operação.",
      color: "from-red-500 to-red-700",
      path: "/avarias",
    },
    {
      title: "Painel Gerencial",
      desc: "Visualize indicadores e relatórios para análise de desempenho.",
      color: "from-green-500 to-green-700",
      path: "/dashboard",
    },
  ];

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-60 w-full p-10 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          Central de Gestão de Operação e Manutenção
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards.map((card, index) => (
            <div
              key={index}
              onClick={() => navigate(card.path)}
              className={`bg-gradient-to-r ${card.color} text-white p-6 rounded-xl cursor-pointer hover:scale-105 transition-transform shadow-md`}
            >
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              <p className="text-sm opacity-90">{card.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-sm text-gray-500">
          Desenvolvido por <strong>INOVEQUATAÍ</strong> © 2025 — Sistema Integrado de Gestão.
        </div>
      </div>
    </div>
  );
}
