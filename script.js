// CONFIGURAÇÃO DO SEU BANCO DE DADOS FIREBASE (Coletado do print)
const firebaseConfig = {
    apiKey: "AIzaSyAyHBm5IttXxxflsmT26ETdWmLYEaBmfzo",
    authDomain: "sistemaescolarpro-ed9e6.firebaseapp.com",
    projectId: "sistemaescolarpro-ed9e6",
    storageBucket: "sistemaescolarpro-ed9e6.firebasestorage.app",
    messagingSenderId: "343508823306",
    appId: "1:343508823306:web:d7e2e140ac8a0f1c171ef3"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// CONFIGURAÇÕES DE MATÉRIAS
const materiasEF = ["Língua Portuguesa", "Língua Inglesa", "Matemática", "Ciências", "História", "Geografia", "Artes", "Educação Física"];
const materiasEM = ["Língua Portuguesa", "Língua Inglesa", "Matemática", "Física", "Química", "Biologia", "História", "Geografia", "Redação", "Educação Física"];

// LISTAS NOMINAIS FIXAS PARA GERAR GRADES DE ALUNOS
const meninos = ["Alonso", "Bruno", "Carlos", "Daniel", "Eduardo", "Felipe", "Gabriel", "Heitor", "Igor", "João"];
const meninas = ["Ana", "Beatriz", "Camila", "Diana", "Elena", "Fernanda", "Gabriela", "Heloísa", "Isabela", "Júlia"];
const sobrenomes = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes"];

const matrizHorarios = [
    { hora: "07:30 - 08:20", tipo: "aula", label: "1ª Aula" },
    { hora: "08:20 - 09:10", tipo: "aula", label: "2ª Aula" },
    { hora: "09:10 - 09:25", tipo: "intervalo", label: "1º Intervalo (Lanche)" },
    { hora: "09:25 - 10:15", tipo: "aula", label: "3ª Aula" },
    { hora: "10:15 - 11:05", tipo: "aula", label: "4ª Aula" },
    { hora: "11:05 - 11:55", tipo: "aula", label: "5ª Aula" },
    { hora: "11:55 - 12:55", tipo: "intervalo", label: "2º Intervalo (Almoço)" },
    { hora: "12:55 - 13:45", tipo: "aula", label: "6ª Aula" },
    { hora: "13:45 - 14:35", tipo: "aula", label: "7ª Aula" },
    { hora: "14:35 - 14:50", tipo: "intervalo", label: "3º Intervalo (Lanche)" },
    { hora: "14:50 - 15:40", tipo: "aula", label: "8ª Aula" },
    { hora: "15:40 - 16:30", tipo: "aula", label: "9ª Aula" }
];

// Vetores globais em memória síncrona alimentados pelo Firebase
let bancoAlunos = {};
let ocorrencias = [];
let alunoSelecionadoId = null;
let alunoOcorrenciaSelecionadoId = null; 
let modoCriacaoNovo = false; 
let meuGrafico = null;

// FUNÇÃO DE CRIPTOGRAFIA (Gera um Hash SHA-256 seguro para as senhas)
async function gerarHash(senhaTextoLimpo) {
    const msgBuffer = new TextEncoder().encode(senhaTextoLimpo);                    
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);           
    const hashArray = Array.from(new Uint8Array(hashBuffer));                     
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');  
    return hashHex;
}

window.onload = async function() {
    // Sincroniza Alunos e Ocorrências da nuvem antes de validar o login
    await baixarAlunosDoServidor();
    await baixarOcorrenciasDoServidor();
    verificarLogin();
};

async function baixarAlunosDoServidor() {
    try {
        const snapshot = await db.collection("alunos").get();
        if(snapshot.empty) {
            // Se o Firestore do Google estiver vazio, povoa a nuvem pela primeira vez
            await gerarAlunosIniciaisEEnviarServidor();
        } else {
            bancoAlunos = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if(!bancoAlunos[data.turma]) bancoAlunos[data.turma] = [];
                bancoAlunos[data.turma].push({
                    id: doc.id,
                    nome: data.nome,
                    notas: data.notas || {},
                    faltas: data.faltas || {}
                });
            });
        }
    } catch (error) {
        console.error("Erro ao baixar alunos:", error);
    }
}

async function baixarOcorrenciasDoServidor() {
    try {
        const snapshot = await db.collection("ocorrencias").get();
        ocorrencias = [];
        snapshot.forEach(doc => {
            ocorrencias.push({ id: doc.id, ...doc.data() });
        });
    } catch (error) {
        console.error("Erro ao baixar ocorrencias:", error);
    }
}

// CORREÇÃO: Função configurada para gerar todos os 20 alunos por turma na primeira execução
async function gerarAlunosIniciaisEEnviarServidor() {
    const turmas = ["6F", "7F", "8F", "9F", "1M", "2M", "3M"];
    bancoAlunos = {}; 
    
    for (const turma of turmas) {
        bancoAlunos[turma] = [];
        let listaTemporaria = [];

        // LOOP CORRIGIDO: Gera corretamente todos os 20 alunos (10 meninos + 10 meninas)
        for(let i=0; i<10; i++) {
            listaTemporaria.push(`${meninos[i]} ${sobrenomes[i]}`);
            listaTemporaria.push(`${meninas[i]} ${sobrenomes[(i+5)%10]}`);
        }
        listaTemporaria.sort((a, b) => a.localeCompare(b));
        const grade = turma.includes("F") ? materiasEF : materiasEM;

        for (let index = 0; index < listaTemporaria.length; index++) {
            const nomeCompleto = listaTemporaria[index];
            let ficha = {
                turma: turma,
                nome: nomeCompleto,
                notas: {},
                faltas: {} 
            };
            grade.forEach(m => {
                ficha.notas[m] = { participacao: 0, trabalhos: 0, provas: 0 };
                ficha.faltas[m] = 0; 
            });
            
            // Envia cada documento individualmente para a coleção "alunos" no Firebase
            const docRef = await db.collection("alunos").add(ficha);
            bancoAlunos[turma].push({ id: docRef.id, ...ficha });
        }
    }
}

function verificarLogin() {
    const profLogadoNome = localStorage.getItem("profLogado");
    const nomeEscola = localStorage.getItem("profEscola");
    
    if (profLogadoNome) {
        document.getElementById("tela-login").classList.remove("ativa");
        document.getElementById("tela-app").classList.add("ativa");
        
        document.getElementById("nome-escola-topo").innerText = nomeEscola || "Escola Estadual Professora Alcheste de Godoy Andia";
        document.getElementById("usuario-logado-info").innerText = `Professor(a): ${profLogadoNome}`;

        carregarMaterias();
        atualizarAlunos();
        montarTabelaHorarios();
        atualizarOcorrencias();
    }
}

function reordenarListaChamada(turma) {
    if (bancoAlunos[turma]) {
        bancoAlunos[turma].sort((a, b) => a.nome.localeCompare(b.nome));
    }
}

function carregarMaterias() {
    const turma = document.getElementById("filtro-turma").value;
    const selectMat = document.getElementById("filtro-materia");
    selectMat.innerHTML = "";
    
    const grade = turma.includes("F") ? materiasEF : materiasEM;
    grade.forEach(m => {
        selectMat.innerHTML += `<option value="${m}">${m}</option>`;
    });
    fecharPainelLancamento();
    montarTabelaHorarios(); 
}

function contarOcorrenciasAluno(alunoId) {
    return ocorrencias.filter(o => o.alunoId === alunoId).length;
}

function atualizarAlunos() {
    const turma = document.getElementById("filtro-turma").value;
    const materia = document.getElementById("filtro-materia").value;
    const aulasTotais = parseInt(document.getElementById("aulas-total").value) || 40;
    const lista = document.getElementById("lista-alunos");
    lista.innerHTML = "";

    if(!bancoAlunos[turma] || !materia) return;

    reordenarListaChamada(turma);

    bancoAlunos[turma].forEach((a, index) => {
        const n = a.notas[materia] || { participacao: 0, trabalhos: 0, provas: 0 };
        const faltas = a.faltas[materia] || 0;
        
        const totalOcorrencias = contarOcorrenciasAluno(a.id);
        const notaComportamento = Math.max(0, 5 - totalOcorrencias);
        const notaFinal = n.participacao + n.trabalhos + n.provas;
        
        const freqCalculada = ((aulasTotais - faltas) / aulasTotais) * 100;
        const frequenciaFinal = Math.max(0, Math.min(100, freqCalculada.toFixed(0))); 

        const aprovado = (notaFinal >= 9 && frequenciaFinal >= 75 && notaComportamento >= 3);

        const statusFaltasStr = faltas > 20 ? 
            `<span class="status-alerta alerta-perigo">🚨 Acima de 20 Faltas: Enviar aos Pais</span>` : 
            `<span class="status-alerta alerta-ok">👍 Faltas OK</span>`;

        const statusOcStr = totalOcorrencias >= 3 ? 
            `<span class="status-alerta alerta-perigo">🚨 ${totalOcorrencias} Ocorrências: Pais na Escola</span>` : 
            `<span class="status-alerta alerta-ok">👍 Comportamento Regular</span>`;

        lista.innerHTML += `
            <div class="item ${alunoSelecionadoId === a.id ? 'selecionado' : ''}" onclick="selecionarAluno('${a.id}')">
                <div class="item-info">
                    <strong>${index + 1}º - ${a.nome}</strong>
                    <span class="item-detalhe">Part: ${n.participacao.toFixed(1)} | Trab: ${n.trabalhos.toFixed(1)} | Prov: ${n.provas.toFixed(1)} | Total: <strong>${notaFinal.toFixed(1)}</strong></span>
                    <span class="item-detalhe" style="color:#0284c7; font-weight:600;">⭐ Nota Comportamental: ${notaComportamento.toFixed(1)}/5.0</span>
                    <span class="item-detalhe">Faltas nesta matéria: <strong>${faltas}</strong> | Frequência: ${frequenciaFinal}%</span>
                    <div style="margin-top:4px;">${statusFaltasStr} ${statusOcStr}</div>
                </div>
                <span class="status ${aprovado ? 'aprovado' : 'reprovado'}">${aprovado ? '✔' : '✖'}</span>
            </div>
        `;
    });
}

function selecionarAluno(id) {
    modoCriacaoNovo = false;
    alunoSelecionadoId = id;
    const turma = document.getElementById("filtro-turma").value;
    const materia = document.getElementById("filtro-materia").value;
    const aluno = bancoAlunos[turma].find(a => a.id === id);
    
    document.getElementById("titulo-painel").innerText = `Modo Edição de Aluno`;
    document.getElementById("aluno-nome-edit").value = aluno.nome;
    
    const n = aluno.notas[materia] || { participacao: 0, trabalhos: 0, provas: 0 };
    document.getElementById("nota-part").value = n.participacao;
    document.getElementById("nota-trab").value = n.trabalhos;
    document.getElementById("nota-prov").value = n.provas;
    
    const campoFaltas = document.getElementById("aluno-faltas");
    campoFaltas.value = aluno.faltas[materia] || 0;
    validarLimitesFaltas(campoFaltas);
    
    const totalOcorrencias = contarOcorrenciasAluno(id);
    const notaComportamento = Math.max(0, 5 - totalOcorrencias);
    
    document.getElementById("aluno-qtd-ocorrencias").innerText = `Ocorrências Atuais: ${totalOcorrencias}`;
    document.getElementById("aluno-nota-comportamento-painel").innerText = `Nota Comportamental: ${notaComportamento.toFixed(1)} / 5.0`;
    
    const divAlertaComportamento = document.getElementById("alerta-comportamento-painel");
    if (totalOcorrencias >= 3) {
        divAlertaComportamento.className = "status-alerta alerta-perigo";
        divAlertaComportamento.innerText = `🚨 Encaminhar aos Pais! Aluno atingiu o limite crítico (${totalOcorrencias} ocorrências).`;
    } else {
        divAlertaComportamento.className = "status-alerta alerta-ok";
        divAlertaComportamento.innerText = `👍 Status Comportamental sob controle.`;
    }
    
    document.getElementById("btn-salvar-nota").disabled = false;
    document.getElementById("btn-deletar-aluno").disabled = false;
}

function validarLimitesFaltas(input) {
    const f = parseInt(input.value) || 0;
    const divAlerta = document.getElementById("alerta-faltas-painel");
    if(f > 20) {
        divAlerta.className = "status-alerta alerta-perigo";
        divAlerta.innerText = "Aviso: Limite de 20 faltas estourado.";
    } else {
        divAlerta.className = "status-alerta alerta-ok";
        divAlerta.innerText = "Faltas sob controle.";
    }
}

function abrirPainelNovoAluno() {
    modoCriacaoNovo = true;
    alunoSelecionadoId = null;
    document.getElementById("titulo-painel").innerText = "➕ Cadastrar Novo Aluno nesta Turma";
    document.getElementById("aluno-nome-edit").value = "";
    document.getElementById("nota-part").value = 0;
    document.getElementById("nota-trab").value = 0;
    document.getElementById("nota-prov").value = 0;
    document.getElementById("aluno-faltas").value = 0;
    document.getElementById("alerta-faltas-painel").innerText = "";
    
    document.getElementById("btn-salvar-nota").disabled = false;
    document.getElementById("btn-deletar-aluno").disabled = true;
}

function fecharPainelLancamento() {
    alunoSelecionadoId = null;
    modoCriacaoNovo = false;
    document.getElementById("titulo-painel").innerHTML = "Ficha do Aluno (Selecione um na lista abaixo)";
    document.getElementById("aluno-nome-edit").value = "";
    document.getElementById("nota-part").value = 0;
    document.getElementById("nota-trab").value = 0;
    document.getElementById("nota-prov").value = 0;
    document.getElementById("aluno-faltas").value = 0;
    document.getElementById("alerta-faltas-painel").innerText = "";
    
    document.getElementById("btn-salvar-nota").disabled = true;
    document.getElementById("btn-deletar-aluno").disabled = true;
    atualizarAlunos();
}

async function salvarDadosAluno() {
    const turma = document.getElementById("filtro-turma").value;
    const materia = document.getElementById("filtro-materia").value;
    const nomeInput = document.getElementById("aluno-nome-edit").value.trim();
    
    const p = parseFloat(document.getElementById("nota-part").value) || 0;
    const t = parseFloat(document.getElementById("nota-trab").value) || 0;
    const pr = parseFloat(document.getElementById("nota-prov").value) || 0;
    const flt = parseInt(document.getElementById("aluno-faltas").value) || 0;

    if (!nomeInput) return alert("Por favor, preencha o nome.");

    if (modoCriacaoNovo) {
        let novoAlunoFirebase = { turma: turma, nome: nomeInput, notas: {}, faltas: {} };
        const grade = turma.includes("F") ? materiasEF : materiasEM;
        
        grade.forEach(m => {
            novoAlunoFirebase.notas[m] = { participacao: 0, trabalhos: 0, provas: 0 };
            novoAlunoFirebase.faltas[m] = 0;
        });
        novoAlunoFirebase.notas[materia] = { participacao: p, trabalhos: t, provas: pr };
        novoAlunoFirebase.faltas[materia] = flt;

        const docRef = await db.collection("alunos").add(novoAlunoFirebase);
        if(!bancoAlunos[turma]) bancoAlunos[turma] = [];
        bancoAlunos[turma].push({ id: docRef.id, ...novoAlunoFirebase });
    } else {
        const aluno = bancoAlunos[turma].find(a => a.id === alunoSelecionadoId);
        aluno.nome = nomeInput;
        aluno.notas[materia] = { participacao: p, trabalhos: t, provas: pr };
        aluno.faltas[materia] = flt;

        await db.collection("alunos").doc(alunoSelecionadoId).update({
            nome: nomeInput,
            notas: aluno.notas,
            faltas: aluno.faltas
        });
    }

    fecharPainelLancamento();
}

async function excluirAluno() {
    if (!alunoSelecionadoId) return;
    const turma = document.getElementById("filtro-turma").value;
    if (confirm("Deseja mesmo remover este aluno permanentemente da nuvem?")) {
        await db.collection("alunos").doc(alunoSelecionadoId).delete();
        bancoAlunos[turma] = bancoAlunos[turma].filter(a => a.id !== alunoSelecionadoId);
        fecharPainelLancamento();
    }
}

function listarAlunosOcorrencia() {
    const turma = document.getElementById("oc-turma").value;
    const container = document.getElementById("oc-lista-alunos");
    container.innerHTML = "";
    
    document.getElementById("oc-bloco-registro").classList.add("desativado");
    alunoOcorrenciaSelecionadoId = null;

    if(!turma || !bancoAlunos[turma]) {
        container.innerHTML = "Selecione uma turma acima...";
        return;
    }

    reordenarListaChamada(turma);

    bancoAlunos[turma].forEach(a => {
        container.innerHTML += `
            <div id="item-oc-aluno-${a.id}" class="aluno-click-item" onclick="selecionarAlunoParaOcorrencia('${a.id}', '${a.nome}')">
                ${a.nome} <small style="color:#64748b;">(Comunicados: ${contarOcorrenciasAluno(a.id)})</small>
            </div>
        `;
    });
}

function selecionarAlunoParaOcorrencia(id, nomeCompleto) {
    alunoOcorrenciaSelecionadoId = id;
    document.querySelectorAll(".aluno-click-item").forEach(el => el.classList.remove("selecionado"));
    const elementoSelecionado = document.getElementById(`item-oc-aluno-${id}`);
    if(elementoSelecionado) elementoSelecionado.classList.add("selecionado");

    document.getElementById("oc-bloco-registro").classList.remove("desativado");
    document.getElementById("oc-nome-aluno-selecionado").innerText = `Encaminhamento para: ${nomeCompleto}`;
}

async function addOcorrencia() {
    const texto = document.getElementById("oc-texto").value.trim();
    const turma = document.getElementById("oc-turma").value;
    const tipo = document.getElementById("oc-tipo").value;
    
    if (!alunoOcorrenciaSelecionadoId || !texto) return alert("Preencha todos os dados!");
    
    const alunoFicha = bancoAlunos[turma].find(a => a.id === alunoOcorrenciaSelecionadoId);

    const novaOc = {
        alunoId: alunoOcorrenciaSelecionadoId,
        alunoNome: alunoFicha.nome,
        turma: turma,
        tipo: tipo,
        texto: texto,
        data: new Date().toLocaleDateString('pt-BR')
    };

    const docRef = await db.collection("ocorrencias").add(novaOc);
    ocorrencias.push({ id: docRef.id, ...novaOc });

    document.getElementById("oc-texto").value = "";
    listarAlunosOcorrencia();
    atualizarOcorrencias();
    atualizarAlunos(); 
}

async function excluirOcorrencia(idOcorrencia) {
    if(confirm("Deseja deletar permanentemente este comunicado da nuvem?")) {
        await db.collection("ocorrencias").doc(idOcorrencia).delete();
        ocorrencias = ocorrencias.filter(o => o.id !== idOcorrencia);
        atualizarOcorrencias();
        listarAlunosOcorrencia();
        atualizarAlunos();
    }
}

function atualizarOcorrencias() {
    const lista = document.getElementById("lista-ocorrencias");
    lista.innerHTML = "";
    if(ocorrencias.length === 0) {
        lista.innerHTML = "<p style='color:#64748b; font-size:13px;'>Nenhuma ocorrência registrada na escola.</p>";
        return;
    }
    ocorrencias.forEach(o => {
        lista.innerHTML += `
            <div class="item" style="border-left: 4px solid #c2410c;">
                <div class="item-info">
                    <strong>[${o.turma}] ${o.alunoNome}</strong> - <small>${o.data}</small><br>
                    <span style="color:#c2410c; font-weight:600; font-size:12px;">Motivo: ${o.tipo}</span><br>
                    <span class="item-detalhe">"${o.texto}"</span>
                </div>
                <button onclick="excluirOcorrencia('${o.id}')" class="btn-perigo" style="padding:2px 8px; font-size:11px;">Excluir</button>
            </div>
        `;
    });
}

function atualizarGrafico() {
    const ctx = document.getElementById('chartGeral').getContext('2d');
    const turma = document.getElementById("filtro-turma").value;
    const materia = document.getElementById("filtro-materia").value;
    const aulasTotais = parseInt(document.getElementById("aulas-total").value) || 40;
    
    const listagem = bancoAlunos[turma] || [];
    reordenarListaChamada(turma);
    
    const labels = listagem.map((a, idx) => `Nº ${idx + 1}`);
    const dataNotasFinais = listagem.map(a => {
        const n = a.notas[materia] || { participacao: 0, trabalhos: 0, provas: 0 };
        return n.participacao + n.trabalhos + n.provas;
    });
    
    const dataFrequencias = listagem.map(a => {
        const flt = a.faltas[materia] || 0;
        return ((aulasTotais - flt) / aulasTotais) * 15; 
    });

    const dataComportamentos = listagem.map(a => {
        const totalOcorrencias = contarOcorrenciasAluno(a.id);
        return Math.max(0, 5 - totalOcorrencias) * 3; 
    });

    if (meuGrafico) meuGrafico.destroy();

    meuGrafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Nota Final Acadêmica (Máx: 15)', data: dataNotasFinais, backgroundColor: '#004080' },
                { label: 'Frequência Proporcional (Máx: 15)', data: dataFrequencias, backgroundColor: '#2e7d32' },
                { label: 'Conduta / Comportamento (Máx: 15)', data: dataComportamentos, backgroundColor: '#f57c00' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 15 } } }
    });
}

function montarTabelaHorarios() {
    const turma = document.getElementById("filtro-turma").value;
    const container = document.getElementById("grade-horarios");
    const grade = turma.includes("F") ? materiasEF : materiasEM;
    const turmasIndices = {"6F":0, "7F":2, "8F":4, "9F":6, "1M":1, "2M":3, "3M":5};
    const offset = turmasIndices[turma] || 0;

    let html = `<table><tr><th>Horário</th><th>Segunda</th><th>Terça</th><th>Quarta</th><th>Quinta</th><th>Sexta</th></tr>`;
    matrizHorarios.forEach((h, index) => {
        if(h.tipo === "intervalo") {
            html += `<tr class="intervalo-row"><td>${h.hora}</td><td colspan="5">${h.label}</td></tr>`;
        } else {
            let tempoDeAula = index; 
            if(index > 9) tempoDeAula = index - 3;
            else if(index > 6) tempoDeAula = index - 2;
            else if(index > 2) tempoDeAula = index - 1;

            let blocoId = Math.floor(tempoDeAula / 2);
            let s1 = grade[(blocoId + offset) % grade.length];
            let s2 = grade[(blocoId + offset + 2) % grade.length];
            let s3 = grade[(blocoId + offset + 4) % grade.length];
            let s4 = grade[(blocoId + offset + 1) % grade.length];
            let s5 = grade[(blocoId + offset + 3) % grade.length];

            html += `<tr><td style="font-weight:bold; background:#f1f5f9;">${h.hora}<br><small style="color:#64748b;">${h.label}</small></td><td>${s1}</td><td>${s2}</td><td>${s3}</td><td>${s4}</td><td>${s5}</td></tr>`;
        }
    });
    container.innerHTML = html;
}

function navegar(idAba, botao) {
    document.querySelectorAll(".aba").forEach(a => a.classList.remove("ativa"));
    document.querySelectorAll(".btn-menu").forEach(b => b.classList.remove("ativo"));
    document.getElementById(idAba).classList.add("ativa");
    botao.classList.add("ativo");
    if (idAba === 'aba-grafico') atualizarGrafico();
    if (idAba === 'aba-horarios') montarTabelaHorarios();
    if (idAba === 'aba-ocorrencias') { document.getElementById("oc-turma").value = ""; listarAlunosOcorrencia(); atualizarOcorrencias(); }
}

async function entrar(event) {
    if(event) event.preventDefault();

    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    
    if (user === "admin" && pass === "1234") {
        localStorage.setItem("profLogado", "admin");
        localStorage.setItem("profEscola", "Escola Administradora Geral");
        verificarLogin();
        return;
    }

    const senhaCriptografadaDigitada = await gerarHash(pass);

    try {
        const snapshot = await db.collection("professores")
                                  .where("user", "==", user)
                                  .where("pass", "==", senhaCriptografadaDigitada)
                                  .get();

        if (!snapshot.empty) {
            const dadosProf = snapshot.docs[0].data();
            localStorage.setItem("profLogado", user);
            localStorage.setItem("profEscola", dadosProf.escola);
            verificarLogin();
        } else {
            alert("Acesso negado! Nome de usuário ou senha incorretos.");
        }
    } catch (e) {
        alert("Erro ao conectar ao banco de dados: " + e.message);
    }
}

function sair() {
    localStorage.removeItem("profLogado");
    localStorage.removeItem("profEscola");
    document.getElementById("tela-app").classList.remove("ativa");
    document.getElementById("tela-login").classList.add("ativa");
}

function mudarTelaLogin(tela) {
    document.getElementById("login-user").value = "";
    document.getElementById("login-pass").value = "";
    document.getElementById("tela-login").className = "tela " + (tela === 'login' ? 'ativa' : '');
    document.getElementById("tela-cadastro").className = "tela " + (tela === 'cadastro' ? 'ativa' : '');
}

async function cadastrar() {
    const user = document.getElementById("cad-user").value.trim();
    const escl = document.getElementById("cad-escola").value.trim();
    const pass = document.getElementById("cad-pass").value.trim();
    
    if (!user || !escl || !pass) {
        alert("Por favor, preencha todos os campos do cadastro!");
        return;
    }

    try {
        const snapshot = await db.collection("professores").where("user", "==", user).get();
        if(!snapshot.empty) {
            alert("Este nome de professor já está registrado!");
            return;
        }

        const senhaSegura = await gerarHash(pass);
        
        await db.collection("professores").add({
            user: user,
            escola: escl,
            pass: senhaSegura
        });
        
        alert("Professor cadastrado com segurança direto na nuvem!"); 
        
        document.getElementById("cad-user").value = "";
        document.getElementById("cad-escola").value = "";
        document.getElementById("cad-pass").value = "";
        mudarTelaLogin('login');
    } catch (e) {
        alert("Erro ao salvar cadastro: " + e.message);
    }
}