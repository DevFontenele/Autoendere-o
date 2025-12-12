// ELEMENTOS
const ruaInput = document.getElementById('rua');
const sugestoesRua = document.getElementById('sugestoes-rua');
const bairroInput = document.getElementById('bairro');
const cidadeInput = document.getElementById('cidade');
const estadoInput = document.getElementById('estado');
const cepInput = document.getElementById('cep');
const listaOpcoesCep = document.getElementById('lista-opcoes-cep');
const form = document.getElementById('form-endereco');
const listaCeps = document.getElementById('lista-ceps');
const btnGps = document.getElementById('btn-gps');

const modalLocalizacaoEl = document.getElementById('modalLocalizacao');
const modalLocalizacao = new bootstrap.Modal(modalLocalizacaoEl);
const confirmarLocalizacaoBtn = document.getElementById('confirmarLocalizacao');

let cepValido = false;
let debounceTimer = null;

// Mapa simples (nome estado => sigla). Pode ser estendido.
const estadosMap = {
  "acre":"AC","alagoas":"AL","amapa":"AP","amazonas":"AM","bahia":"BA","ceara":"CE",
  "distrito federal":"DF","espírito santo":"ES","goias":"GO","roraima":"RR",
  "rondonia":"RO","para":"PA","paraiba":"PB","parana":"PR","pernambuco":"PE",
  "piaui":"PI","rio de janeiro":"RJ","rio grande do norte":"RN",
  "rio grande do sul":"RS","santa catarina":"SC","sao paulo":"SP",
  "sergipe":"SE","tocantins":"TO","mato grosso":"MT","mato grosso do sul":"MS"
};

/* ============================
   AUTOCOMPLETE (Nominatim)
   - quando o usuário digita na rua, pergunta Nominatim por sugestões
============================ */
ruaInput.addEventListener('input', () => {
  const q = ruaInput.value.trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  if (!q || q.length < 3) { sugestoesRua.style.display='none'; return; }
  debounceTimer = setTimeout(() => buscarSugestoesRua(q), 300);
});

async function buscarSugestoesRua(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=br&q=${encodeURIComponent(query)}&limit=8`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' }});
    const data = await resp.json();

    sugestoesRua.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      sugestoesRua.style.display = 'none';
      return;
    }

    data.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action sugestao-item';
      // label amigável
      btn.textContent = item.display_name;
      btn.addEventListener('click', () => aplicarSugestao(item));
      sugestoesRua.appendChild(btn);
    });
    sugestoesRua.style.display = 'block';
  } catch (e) {
    console.error('Erro sugestões Nominatim', e);
    sugestoesRua.style.display = 'none';
  }
}

function aplicarSugestao(item) {
  const ad = item.address || {};
  ruaInput.value = ad.road || ad.pedestrian || ad.cycleway || item.display_name.split(',')[0] || '';
  bairroInput.value = ad.suburb || ad.neighbourhood || ad.village || '';
  cidadeInput.value = ad.city || ad.town || ad.village || ad.county || '';
  const stateName = (ad.state || '').toString().toLowerCase();
  estadoInput.value = estadosMap[stateName] || (ad.state ? ad.state.slice(0,2).toUpperCase() : '');
  sugestoesRua.style.display = 'none';

  // buscar CEPs para o endereço preenchido (se tivermos UF e cidade)
  if (estadoInput.value && cidadeInput.value && ruaInput.value) {
    buscarCEPsPorEndereco(estadoInput.value, cidadeInput.value, ruaInput.value);
  }
}

// fechar sugestões ao clicar fora
document.addEventListener('click', (e) => {
  if (!sugestoesRua.contains(e.target) && e.target !== ruaInput) {
    sugestoesRua.style.display = 'none';
  }
});

/* ============================
   BUSCAR CEPs POR ENDEREÇO (ViaCEP)
   /ws/UF/CIDADE/RUA/json/
============================ */
async function buscarCEPsPorEndereco(uf, cidade, rua) {
  listaOpcoesCep.innerHTML = 'Buscando CEPs...';
  try {
    const ufNorm = uf.trim().toUpperCase();
    const url = `https://viacep.com.br/ws/${encodeURIComponent(ufNorm)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;
    const resp = await fetch(url);
    const data = await resp.json();

    listaOpcoesCep.innerHTML = '';
    if (!Array.isArray(data) || data.length === 0) {
      listaOpcoesCep.innerHTML = '<div class="text-muted">Nenhum CEP encontrado para esse endereço.</div>';
      return;
    }

    if (data.length === 1) {
      cepInput.value = data[0].cep;
      cepValido = true;
      return;
    }

    // mais de um resultado: mostrar opções clicáveis
    data.forEach(d => {
      const div = document.createElement('div');
      div.className = 'opcao-cep';
      div.textContent = `${d.cep} — ${d.logradouro || ''} ${d.bairro ? `(${d.bairro})` : ''}`;
      div.addEventListener('click', () => {
        cepInput.value = d.cep;
        cepValido = true;
        listaOpcoesCep.innerHTML = '';
      });
      listaOpcoesCep.appendChild(div);
    });

  } catch (e) {
    console.error('Erro buscarCEPsPorEndereco', e);
    listaOpcoesCep.innerHTML = '<div class="text-danger">Erro ao buscar CEPs.</div>';
  }
}

/* ============================
   DIGITAR CEP -> BUSCAR ENDEREÇO (ViaCEP)
============================ */
cepInput.addEventListener('input', () => {
  // máscara simples 00000-000
  let v = cepInput.value.replace(/\D/g,'');
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5,8);
  cepInput.value = v;

  const onlyNumbers = cepInput.value.replace(/\D/g,'');
  if (onlyNumbers.length === 8) buscarEnderecoPorCEP(onlyNumbers);
});

async function buscarEnderecoPorCEP(cep) {
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) {
      alert('CEP não encontrado.');
      return;
    }
    ruaInput.value = data.logradouro || '';
    bairroInput.value = data.bairro || '';
    cidadeInput.value = data.localidade || '';
    estadoInput.value = data.uf || '';
    cepValido = true;
  } catch (e) {
    console.error('Erro buscarEnderecoPorCEP', e);
  }
}

/* ============================
   GPS: abrir modal -> pegar coords -> Nominatim reverse -> preencher
============================ */
btnGps.addEventListener('click', () => modalLocalizacao.show());

// confirmar no modal
confirmarLocalizacaoBtn.addEventListener('click', async () => {
  modalLocalizacao.hide();

  if (!navigator.geolocation) {
    alert('Geolocalização não suportada no seu navegador.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' }});
      const data = await resp.json();

      if (data && data.address) {
        // preencher campos
        ruaInput.value = data.address.road || data.address.pedestrian || data.display_name.split(',')[0] || '';
        bairroInput.value = data.address.suburb || data.address.neighbourhood || '';
        cidadeInput.value = data.address.city || data.address.town || data.address.village || data.address.county || '';
        const stateName = (data.address.state || '').toLowerCase();
        estadoInput.value = estadosMap[stateName] || (data.address.state ? data.address.state.slice(0,2).toUpperCase() : '');

        // se Nominatim trouxe postcode (CEP), preenche diretamente
        if (data.address.postcode) {
          const pc = data.address.postcode.replace(/\D/g,'');
          cepInput.value = pc.length === 8 ? pc.slice(0,5) + '-' + pc.slice(5) : data.address.postcode;
          cepValido = true;
        } else {
          // tentar buscar CEPs por endereço se não houver postcode
          if (estadoInput.value && cidadeInput.value && ruaInput.value) {
            buscarCEPsPorEndereco(estadoInput.value, cidadeInput.value, ruaInput.value);
          }
        }
      } else {
        alert('Não foi possível obter o endereço a partir da localização.');
      }

    } catch (e) {
      console.error('Erro reverse geocode', e);
      alert('Erro ao obter endereço da localização.');
    }

  }, (err) => {
    console.error('Erro geolocalização', err);
    alert('Não foi possível obter sua localização.');
  }, { enableHighAccuracy: true, timeout: 10000 });
});

/* ============================
   FORM: salvar / listar / deletar
============================ */
form.addEventListener('submit', (ev) => {
  ev.preventDefault();

  const endereco = {
    cep: cepInput.value,
    rua: ruaInput.value,
    bairro: bairroInput.value,
    cidade: cidadeInput.value,
    estado: estadoInput.value,
    numero: document.getElementById('numero').value,
    complemento: document.getElementById('complemento').value
  };

  if (!endereco.numero) {
    alert('Informe o número do endereço.');
    return;
  }

  const lista = JSON.parse(localStorage.getItem('enderecos')) || [];
  lista.push(endereco);
  localStorage.setItem('enderecos', JSON.stringify(lista));

  form.reset();
  sugestoesRua.style.display = 'none';
  listaOpcoesCep.innerHTML = '';
  cepValido = false;
  mostrarEnderecos();
});

function mostrarEnderecos() {
  const lista = JSON.parse(localStorage.getItem('enderecos')) || [];
  listaCeps.innerHTML = '<h5>Endereços cadastrados:</h5>';
  if (lista.length === 0) {
    listaCeps.innerHTML += '<p class="text-muted">Nenhum endereço cadastrado.</p>';
    return;
  }
  lista.forEach((e,i) => {
    const div = document.createElement('div');
    div.className = 'end-item border rounded p-2 mb-2 d-flex justify-content-between';
    div.innerHTML = `<div><strong>${e.cep}</strong> — ${e.rua}, ${e.numero} (${e.bairro} - ${e.cidade}/${e.estado})</div>
      <button class="btn-delete" onclick="deletarEndereco(${i})">Excluir</button>`;
    listaCeps.appendChild(div);
  });
}
function deletarEndereco(i) {
  const lista = JSON.parse(localStorage.getItem('enderecos')) || [];
  lista.splice(i,1);
  localStorage.setItem('enderecos', JSON.stringify(lista));
  mostrarEnderecos();
}

// inicializa lista ao carregar
mostrarEnderecos();
