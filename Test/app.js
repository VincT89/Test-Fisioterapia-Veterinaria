(() => {
  'use strict';
  const data = window.QUIZ_DATA;
  const main = document.getElementById('main');
  const status = document.getElementById('status');
  const notice = document.getElementById('storage-notice');
  const dialog = document.getElementById('confirm-dialog');
  const key = 'fisioterapia-veterinaria-progressi-v1';
  const tests = new Map(data.tests.map(test => [test.id, test]));
  const labels = ['Da ripassare', 'Parziale', 'Completa'];
  const letters = ['A', 'B', 'C', 'D'];
  let current = null;
  let onlyErrors = false;
  let confirmAction = null;
  let persistError = false;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const own = (object, prop) => Object.prototype.hasOwnProperty.call(object, prop);
  function message(text) { status.textContent = text; }
  function showNotice(text) { notice.textContent = text; notice.hidden = false; }
  function fresh() { return {schema:1, dataset:data.version, attempts:{}}; }
  function load() {
    let result = fresh();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      if (!stored) return result;
      if (stored.schema !== 1 || stored.dataset !== data.version || !stored.attempts || typeof stored.attempts !== 'object') {
        showNotice('I progressi salvati appartengono a una versione diversa. Questa raccolta inizia senza risposte.');
        return result;
      }
      for (const test of data.tests) {
        const a = stored.attempts[test.id];
        if (!a || typeof a !== 'object') continue;
        const clean = {answers:{}, grades:{}, index:0, submitted:a.submitted === true};
        clean.index = Number.isInteger(a.index) ? Math.min(Math.max(0,a.index),test.questions.length-1) : 0;
        for (const question of test.questions) {
          const answer = a.answers?.[question.id];
          if (test.kind === 'M' && Number.isInteger(answer) && answer >= 0 && answer <= 3) clean.answers[question.id] = answer;
          if (test.kind === 'O' && typeof answer === 'string') clean.answers[question.id] = answer.slice(0,8000);
          const grade = a.grades?.[question.id];
          if (test.kind === 'O' && clean.submitted && Number.isInteger(grade) && grade >= 0 && grade <= 2) clean.grades[question.id] = grade;
        }
        result.attempts[test.id] = clean;
      }
    } catch {
      showNotice('Il browser non consente di leggere i progressi salvati. Puoi svolgere i test; verifica l’avviso di salvataggio prima di chiudere.');
    }
    return result;
  }
  let state = load();
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      if (persistError) { notice.hidden = true; persistError = false; }
    } catch {
      persistError = true;
      showNotice('Il browser non riesce a salvare i progressi. Mantieni aperta questa pagina: chiudendola potresti perdere le risposte. Al termine puoi esportare il risultato.');
    }
  }
  function attempt(test) {
    if (!state.attempts[test.id]) state.attempts[test.id] = {answers:{},grades:{},index:0,submitted:false};
    return state.attempts[test.id];
  }
  function answered(test, a, q) { return test.kind === 'M' ? Number.isInteger(a.answers[q.id]) : Boolean(a.answers[q.id]?.trim()); }
  function countAnswered(test,a) { return test.questions.filter(q => answered(test,a,q)).length; }
  function score(test,a) { return test.questions.filter(q => a.answers[q.id] === q.correct).length; }
  function openScore(test,a) {
    const marked = test.questions.filter(q => own(a.grades,q.id));
    return {count:marked.length,points:marked.reduce((sum,q) => sum+a.grades[q.id],0)};
  }
  function title(test) { return `Test ${test.number} a risposta ${test.kind === 'M' ? 'multipla' : 'aperta'}`; }
  function source(q) { return `<p class="reference">Riferimento: pagine ${esc(q.pages)} del PDF fornito.</p>`; }
  function focusHeading() { main.querySelector('h1')?.focus(); window.scrollTo(0,0); }
  function navigateQuestion(index) {
    if (!current) return;
    const a = attempt(current);
    a.index = Math.min(Math.max(index,0), current.questions.length-1);
    save(); renderQuiz(current); main.querySelector('#question-title').focus();
    main.querySelector('.progress-line').scrollIntoView({block:'start'});
  }
  function renderHome(kind) {
    current = null;
    document.title = 'Test di fisioterapia veterinaria';
    const multiple = kind === 'M';
    main.innerHTML = `<div class="home-intro"><div><h1 tabindex="-1">Allenati per l’esame.</h1><p>Scegli una prova, rispondi con i tuoi tempi e torna sui concetti da ripassare.</p></div><div class="book-reference"><p>Il manuale di riferimento</p><cite>Fisioterapia riabilitativa <br>del cane e del gatto</cite><span>Ludovica Dragone, Edra</span></div></div><section class="test-selector" aria-label="Scegli un test"><nav class="test-types" aria-label="Tipo di test"><a href="#m" ${multiple?'aria-current="page"':''}><strong>Risposta multipla</strong><span>40 domande e correzione automatica</span></a><a href="#o" ${!multiple?'aria-current="page"':''}><strong>Risposta aperta</strong><span>20 domande e risposte modello</span></a></nav><div class="list-intro"><h2>${multiple?'Scegli un test a risposta multipla':'Scegli un test a risposta aperta'}</h2><p>${multiple?'Una sola risposta corretta per domanda.':'Consegna, confronta e autovaluta le tue risposte.'}</p></div><ul class="test-list">${data.tests.filter(t=>t.kind===kind).map(t=>{
      const a = state.attempts[t.id]; let detail = `${t.questions.length} domande su tutti gli argomenti`; let action = 'Inizia';
      if(a){const n=countAnswered(t,a);if(a.submitted){action=multiple?'Correzione':'Confronta';detail=multiple?`${score(t,a)} corrette su 40. Test completato.`:`${openScore(t,a).count} autovalutate su 20. Test consegnato.`;}else{action='Riprendi';detail=`In corso. ${n} risposte inserite su ${t.questions.length}.`;}}
      return `<li class="test-row"><div><h3>Test ${t.number}</h3><p>${detail}</p></div><a class="test-action ${a?'started':''}" href="#${t.id}" aria-label="${action} il test ${t.number} a risposta ${multiple?'multipla':'aperta'}">${action}</a></li>`;
    }).join('')}</ul><p class="save-note">I progressi restano in questo browser. Puoi interrompere una prova e riprenderla più tardi.</p></section><div class="home-notes"><details><summary>Che cosa troverai nei test</summary><p>600 domande distinte, ricavate dai nove capitoli del manuale. Ogni prova combina più argomenti.</p><ul>${data.topics.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><p>Ogni soluzione indica le pagine del PDF da rileggere. <a href="#guida">Fonte e istruzioni</a></p></details>${/^https?:$/.test(location.protocol)?'<button class="text-button copy-link" data-action="copy-link">Copia il link del programma</button>':''}</div>`;
  }
  function renderQuiz(test) {
    const a = attempt(test); const q = test.questions[a.index]; const n = countAnswered(test,a);
    document.title = `${title(test)} | Fisioterapia veterinaria`;
    main.innerHTML = `<div class="test-main"><a class="back-link" href="#${test.kind.toLowerCase()}">Tutti i test</a><div class="test-header"><div><h1 tabindex="-1">${title(test)}</h1><p class="muted">${test.kind==='M'?'Scegli una sola risposta. La correzione sarà disponibile alla consegna.':'Scrivi la tua risposta. Alla consegna potrai confrontarla con il modello.'}</p></div></div><div class="progress-line"><p>Domanda ${a.index+1} di ${test.questions.length}</p><p id="answered-count">${n} risposte inserite</p></div><progress id="answer-progress" value="${n}" max="${test.questions.length}" aria-label="Domande con risposta"></progress><section class="question-area" aria-labelledby="question-title"><p class="topic">${esc(data.topics[q.topic-1])}</p><h2 id="question-title" tabindex="-1">${esc(q.prompt)}</h2>${test.kind==='M'?`<fieldset class="answers" aria-labelledby="question-title"><legend class="sr-only">Scegli una risposta</legend>${q.options.map((option,i)=>`<label class="option"><input type="radio" name="answer" value="${i}" ${a.answers[q.id]===i?'checked':''}><span><span class="option-letter">${letters[i]}.</span>${esc(option)}</span></label>`).join('')}</fieldset><button class="text-button" data-action="clear-answer">Cancella la scelta</button>`:`<label class="response-label" for="open-answer">La tua risposta</label><textarea id="open-answer" maxlength="8000" placeholder="Scrivi qui il tuo ragionamento…" spellcheck="true" aria-describedby="answer-hint">${esc(a.answers[q.id] || '')}</textarea><p class="answer-hint" id="answer-hint">Non occorre usare le stesse parole del libro. Spiega i concetti e i collegamenti. Massimo 8.000 caratteri.</p>`}</section><nav class="question-nav" aria-label="Navigazione fra domande"><button data-action="previous" ${a.index===0?'disabled':''}>Precedente</button>${a.index<test.questions.length-1?'<button class="primary" data-action="next">Successiva</button>':'<button class="primary" data-action="submit">Consegna il test</button>'}</nav><details class="question-index"><summary>Vai a una domanda</summary><div class="question-grid">${test.questions.map((item,i)=>`<button data-question="${i}" class="${answered(test,a,item)?'answered':''}" ${i===a.index?'aria-current="true"':''} aria-label="Domanda ${i+1}, ${answered(test,a,item)?'risposta inserita':'senza risposta'}">${i+1}</button>`).join('')}</div><p class="index-legend">Le caselle verdi indicano una risposta inserita. Puoi modificare tutte le risposte prima della consegna.</p></details><div class="submit-row"><p>Le risposte si salvano mentre scrivi o selezioni. Nessun limite di tempo.</p><button data-action="submit">Consegna il test</button></div></div>`;
  }
  function updateAnswerProgress() {
    const a = attempt(current); const q = current.questions[a.index];
    const n = countAnswered(current,a);
    document.getElementById('answered-count').textContent = `${n} risposte inserite`;
    document.getElementById('answer-progress').value = n;
    const nav = main.querySelector(`[data-question="${a.index}"]`);
    nav.classList.toggle('answered', answered(current,a,q));
    nav.setAttribute('aria-label',`Domanda ${a.index+1}, ${answered(current,a,q)?'risposta inserita':'senza risposta'}`);
  }
  function gradeSummary(test,a) {
    const s = openScore(test,a);
    return `<p class="result-number">${s.count} risposte autovalutate su ${test.questions.length}</p><p>${s.count===test.questions.length?`Autovalutazione: ${s.points} punti su ${test.questions.length*2}.`:`Confronta le risposte e assegna una valutazione a ciascuna. Mancano ${test.questions.length-s.count} valutazioni.`}</p><p class="small muted">È una tua valutazione di ripasso, non un voto assegnato automaticamente.</p>`;
  }
  function renderReview(test) {
    const a = attempt(test); const multiple = test.kind==='M'; const correct = multiple?score(test,a):0;
    const answeredN = countAnswered(test,a); const omitted=test.questions.length-answeredN;
    document.title = `Soluzioni: ${title(test)} | Fisioterapia veterinaria`;
    main.innerHTML = `<div class="test-main"><a class="back-link" href="#${test.kind.toLowerCase()}">Tutti i test</a><h1 tabindex="-1">${title(test)}</h1><p class="muted">${multiple?'Correzione e risposte':'Confronto con le risposte modello'}</p><section class="review-summary" id="review-summary" aria-label="Risultato del test" aria-live="polite">${multiple?`<p class="result-number">${correct} risposte corrette su ${test.questions.length}</p><p>${Math.round(correct/test.questions.length*100)}% corrette. ${answeredN-correct} ${answeredN-correct===1?'errata':'errate'} e ${omitted} ${omitted===1?'non data':'non date'}.</p><p class="small muted">Un punto per risposta corretta; zero per risposte errate o non date.</p>`:gradeSummary(test,a)}</section>${multiple?'':`<p class="small">Leggi il modello cercando i concetti essenziali, anche se li hai espressi con parole diverse. Scegli <strong>Da ripassare (0)</strong> se manca la risposta o il concetto centrale, <strong>Parziale (1)</strong> se ci sono lacune, <strong>Completa (2)</strong> se i punti principali e i collegamenti sono corretti.</p>`}<div class="review-actions"><button data-action="download">Esporta risposte e risultato</button><button data-action="retry">Ripeti questo test</button></div>${multiple?`<label class="filter"><input id="only-errors" type="checkbox" ${onlyErrors?'checked':''}>Mostra solo errori e risposte non date</label>`:''}<div id="review-list">${test.questions.map((q,i)=>{
      const value=a.answers[q.id]; const isAnswered=answered(test,a,q); const right=multiple && value===q.correct;
      if(multiple && onlyErrors && right)return '';
      return `<section class="review-item" aria-labelledby="review-${q.id}"><p class="question-meta">Domanda ${i+1} di ${test.questions.length}. ${esc(data.topics[q.topic-1])}</p><h2 id="review-${q.id}">${esc(q.prompt)}</h2>${multiple?`<p class="outcome ${right?'correct':'wrong'}">${right?'Corretta':isAnswered?'Da correggere':'Risposta non data'}</p><div class="answer-block"><strong>La tua risposta</strong><p>${isAnswered?`${letters[value]}. ${esc(q.options[value])}`:'Non hai risposto.'}</p></div>${right?'':`<div class="answer-block model"><strong>Risposta corretta</strong><p>${letters[q.correct]}. ${esc(q.options[q.correct])}</p></div>`}`:`<div class="answer-block"><strong>La tua risposta</strong><p>${isAnswered?esc(value):'Non hai risposto.'}</p></div><div class="answer-block model"><strong>Risposta modello</strong><p>${esc(q.model)}</p></div>`}${source(q)}${multiple?'':`<fieldset class="grade-fieldset"><legend>Autovalutazione della domanda ${i+1}</legend><div class="grade-options">${labels.map((label,g)=>`<label class="grade-option"><input type="radio" name="grade-${q.id}" data-grade="${q.id}" value="${g}" ${a.grades[q.id]===g?'checked':''}>${label} (${g})</label>`).join('')}</div></fieldset>`}</section>`;
    }).join('') || '<p class="empty-state">Non ci sono errori o risposte mancanti in questo test.</p>'}</div><a class="back-link" href="#${test.kind.toLowerCase()}">Torna all’elenco dei test</a></div>`;
  }
  function renderGuide() {
    current=null;
    document.title='Guida | Test di fisioterapia veterinaria';
    main.innerHTML=`<article class="guide"><a class="back-link" href="#m">Torna ai test</a><h1 tabindex="-1">Come usare i test</h1><p>La raccolta comprende <strong>10 test a risposta multipla di 40 domande</strong> e <strong>10 test a risposta aperta di 20 domande</strong>. Le 600 domande sono distinte; alcuni concetti vengono ripresi da prospettive diverse. Ogni test attraversa più argomenti del manuale.</p><h2>Risposte e correzione</h2><p>Nelle prove a scelta multipla c’è una sola risposta corretta. Puoi saltare una domanda e tornarci prima di consegnare. Alla consegna vengono mostrati il punteggio, le risposte corrette e i riferimenti alle pagine. Le risposte errate o non date valgono zero: non ci sono penalità.</p><p>Nelle prove aperte scrivi prima la tua risposta e, dopo la consegna, confrontala con il modello. I modelli sintetizzano i punti da ricordare: formulazioni diverse possono essere altrettanto valide. L’autovalutazione da 0 a 2 punti è scelta da te; non viene effettuata alcuna correzione tramite IA.</p><p>Da ogni test consegnato puoi esportare e copiare un testo completo con domande, risposte e risultati. Puoi anche ripetere il test: dopo conferma, il tentativo precedente di quel test viene sostituito.</p><h2>Riprendere un test</h2><p>Le risposte sono salvate nel browser e sul dispositivo che stai usando. Per ritrovarle, apri il link nello stesso browser. La navigazione privata, la cancellazione dei dati del browser o il passaggio dal browser interno di WhatsApp a un altro browser possono rendere indisponibili i progressi. Non c’è sincronizzazione fra dispositivi.</p><p>Il programma non invia le risposte al docente o ad altri studenti. Se desideri conservare il risultato, esportalo dopo la consegna. Questo è uno strumento di esercitazione: le soluzioni sono incluse nel programma.</p><h2>Libro e riferimenti</h2><p>Fonte: <cite>Fisioterapia riabilitativa del cane e del gatto</cite>, Ludovica Dragone, Edra, PDF fornito di 258 pagine. Domande e risposte sono una rielaborazione per il ripasso; il libro e le sue immagini non sono inclusi nel programma.</p><p>I riferimenti indicano <strong>il numero della pagina nel file PDF</strong>, contando dalla copertina, e non sempre coincidono con il numero stampato sul libro. Per esempio, la pagina 215 del PDF corrisponde all’inizio del capitolo sui protocolli.</p><table class="guide-table"><thead><tr><th>Contenuto del manuale</th><th>Pagine PDF</th></tr></thead><tbody><tr><td>Introduzione e fondamenti</td><td>4–13</td></tr><tr><td>Termoterapia</td><td>14–28</td></tr><tr><td>Esercizio terapeutico</td><td>29–54</td></tr><tr><td>Idroterapia</td><td>55–72</td></tr><tr><td>Terapie strumentali</td><td>73–148</td></tr><tr><td>Gestione ortopedica e neurologica</td><td>149–214</td></tr><tr><td>Protocollo e valutazione dei risultati</td><td>215–226</td></tr><tr><td>Taping neuromuscolare</td><td>227–240</td></tr><tr><td>Ortesi e ausili</td><td>241–257</td></tr></tbody></table><h2>Studiare con il manuale</h2><p>Le domande verificano i contenuti del libro, comprese le indicazioni e i limiti presentati dall’autrice. Il materiale non è un esame ufficiale e non sostituisce la valutazione clinica. Tempi, parametri e tecniche descritti nel manuale vanno interpretati nel loro contesto: le risposte di ripasso non sono prescrizioni per un animale.</p></article>`;
  }
  function route() {
    const hash=location.hash.slice(1).toLowerCase();
    onlyErrors=false;
    if(hash==='guida')renderGuide();
    else if(tests.has(hash)){current=tests.get(hash);const a=attempt(current);a.submitted?renderReview(current):renderQuiz(current);save();}
    else renderHome(hash==='o'?'O':'M');
    focusHeading();
  }
  function askConfirm(titleText,description,label,action) {
    document.getElementById('dialog-title').textContent=titleText;
    document.getElementById('dialog-description').textContent=description;
    document.getElementById('dialog-confirm').textContent=label;
    confirmAction=action; dialog.showModal();
  }
  function submit() {
    const test=current;const a=attempt(test);const missing=test.questions.length-countAnswered(test,a);
    askConfirm('Consegna il test',`${missing?`Ci sono ${missing} ${missing===1?'domanda senza risposta':'domande senza risposta'}. `:'Hai risposto a tutte le domande. '}${test.kind==='M'?'Vedrai la correzione e il punteggio.':'Vedrai le risposte modello per l’autovalutazione.'} Dopo la consegna le risposte di questo tentativo non saranno modificabili.`, 'Consegna e vedi le risposte',()=>{a.submitted=true;save();renderReview(test);focusHeading();});
  }
  function exportResult() {
    const t=current;const a=attempt(t);const rows=[title(t),'Fisioterapia riabilitativa del cane e del gatto',''];
    if(t.kind==='M')rows.push(`Corrette: ${score(t,a)} su 40. Non date: ${40-countAnswered(t,a)}.`);
    else{const s=openScore(t,a);rows.push(`Autovalutazione: ${s.count} risposte valutate su 20. Punti assegnati: ${s.points}.`);}
    t.questions.forEach((q,i)=>{
      rows.push('',`DOMANDA ${i+1}`,q.prompt);
      if(t.kind==='M'){
        q.options.forEach((o,j)=>rows.push(`${letters[j]}. ${o}`));
        rows.push(`La tua risposta: ${answered(t,a,q)?letters[a.answers[q.id]]+'. '+q.options[a.answers[q.id]]:'Non data'}`,`Risposta corretta: ${letters[q.correct]}. ${q.options[q.correct]}`);
      }else rows.push(`La tua risposta: ${a.answers[q.id]?.trim()||'Non data'}`,`Risposta modello: ${q.model}`,`Autovalutazione: ${own(a.grades,q.id)?labels[a.grades[q.id]]+' ('+a.grades[q.id]+')':'Da completare'}`);
      rows.push(`Riferimento: pagine ${q.pages} del PDF fornito.`);
    });
    rows.push('','I riferimenti usano il numero di pagina nel PDF, contando dalla copertina. Materiale di ripasso, non prova ufficiale.');
    document.getElementById('export-text').value=rows.join('\n');
    document.getElementById('export-status').textContent='';
    document.getElementById('export-dialog').showModal();
  }
  document.getElementById('export-close').addEventListener('click',()=>document.getElementById('export-dialog').close());
  document.getElementById('export-copy').addEventListener('click',async()=>{
    const text=document.getElementById('export-text');
    try{await navigator.clipboard.writeText(text.value);document.getElementById('export-status').textContent='Testo copiato. Puoi incollarlo in un documento o nei tuoi appunti.';}
    catch{text.focus();text.select();document.getElementById('export-status').textContent='Testo selezionato: usa il comando Copia del tuo dispositivo.';}
  });
  main.addEventListener('input',event=>{
    if(!current)return;const target=event.target;const a=attempt(current);
    if(a.submitted){
      if(target.dataset.grade && current.kind==='O'){
        const id=target.dataset.grade;const value=Number(target.value);
        if(current.questions.some(q=>q.id===id) && [0,1,2].includes(value)){a.grades[id]=value;save();document.getElementById('review-summary').innerHTML=gradeSummary(current,a);}
      }
      return;
    }
    const q=current.questions[a.index];
    if(target.name==='answer' && current.kind==='M')a.answers[q.id]=Number(target.value);
    else if(target.id==='open-answer' && current.kind==='O')a.answers[q.id]=target.value.slice(0,8000);
    else return;
    save();updateAnswerProgress();
  });
  main.addEventListener('change',event=>{
    if(event.target.id==='only-errors'){onlyErrors=event.target.checked;renderReview(current);document.getElementById('only-errors').focus();}
  });
  main.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.question!==undefined){navigateQuestion(Number(button.dataset.question));return;}
    const action=button.dataset.action;
    if(action==='copy-link'){
      try{await navigator.clipboard.writeText(location.origin+location.pathname);button.textContent='Link copiato';message('Link copiato. Puoi incollarlo in WhatsApp.');}
      catch{button.textContent='Copia il link dalla barra del browser';message('Copia il link dalla barra degli indirizzi del browser.');}return;
    }
    if(!current)return;const a=attempt(current);
    if(action==='download' && a.submitted)exportResult();
    else if(action==='retry' && a.submitted){const t=current;askConfirm('Ripetere questo test?', 'Le risposte e le valutazioni di questo test saranno sostituite. Puoi prima esportare il risultato per conservarlo. Gli altri test rimangono disponibili.', 'Ricomincia il test',()=>{delete state.attempts[t.id];attempt(t);onlyErrors=false;save();renderQuiz(t);focusHeading();});}
    else if(!a.submitted){
      if(action==='previous')navigateQuestion(a.index-1);
      if(action==='next')navigateQuestion(a.index+1);
      if(action==='submit')submit();
      if(action==='clear-answer'){delete a.answers[current.questions[a.index].id];save();main.querySelectorAll('input[name=answer]').forEach(el=>el.checked=false);updateAnswerProgress();message('Scelta cancellata.');}
    }
  });
  document.getElementById('dialog-cancel').addEventListener('click',()=>{confirmAction=null;dialog.close();});
  document.getElementById('dialog-confirm').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;dialog.close();action?.();});
  dialog.addEventListener('cancel',()=>{confirmAction=null;});
  window.addEventListener('hashchange',route);
  window.addEventListener('pagehide',save);
  route();
})();
