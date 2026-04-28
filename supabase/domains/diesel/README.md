# Diesel

Escopo:

- `diesel_acompanhamentos`
- `diesel_acompanhamento_eventos`
- `diesel_tratativas`
- `diesel_tratativas_detalhes`
- `acompanhamento_lotes`
- `acompanhamento_lote_itens`
- `atas_diesel`
- `atas_diesel_detalhes`
- views e snapshots analiticos do diesel
- buckets `diesel_tratativas` e correlatos

Riscos atuais:

- token GitHub no frontend
- URLs publicas de storage
- acoplamento forte entre operacao e analytics

Objetivo:

- separar operacao, analytics e anexos
- mover automacoes para backend
