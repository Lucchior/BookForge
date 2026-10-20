/* BookForge Web — piccolo libro d'esempio (testo inventato per la prova) per vedere subito l'impaginazione. */
(function () {
  const BF = (window.BF = window.BF || {});

  const P = [
    'La mattina arrivò senza fretta, come arrivano le cose che sanno di avere tutto il tempo. Dalla finestra della cucina si vedeva la strada bagnata e, più in là, il profilo grigio delle colline che il vento non riusciva a spostare. Elena versò il caffè e restò a guardare il vapore salire, pensando che certi giorni hanno bisogno di essere lasciati cominciare da soli.',
    '«Non ti sei ancora pentita?» chiese Marco dalla soglia, con quel sorriso storto che usava quando voleva sembrare più sicuro di quanto fosse. Lei scosse la testa, lentamente. «Di che cosa dovrei pentirmi? Di aver aperto la porta, o di non averla chiusa prima?»',
    'Il paese era fatto di poche case addossate l\'una all\'altra, come per tenersi caldo. In piazza c\'era una fontana senza più acqua e un bar che apriva quando gli andava. I vecchi sedevano sempre agli stessi tavoli, e discutevano di cose accadute prima che molti di loro fossero nati, con la sicurezza di chi le ha vissute tutte.',
    'Nel cassetto trovò la lettera, piegata in quattro e ingiallita ai bordi. Non l\'aveva mai aperta. La scrittura era la sua, ma più rotonda, più giovane, quasi estranea: «Se stai leggendo questo, vuol dire che ce l\'hai fatta a restare. Oppure che sei tornata. In ogni caso, non avere fretta di capire.»',
    'Fuori cominciò a piovere, una pioggia sottile e ostinata che faceva sembrare il mondo un disegno a matita. Elena rimase seduta, con la lettera sulle ginocchia, ascoltando il rumore dell\'acqua sui coppi. Pensò al padre, ai suoi silenzi lunghi, alle domande che non aveva mai osato fargli e che ora, in quella stanza, le sembravano improvvisamente leggere.',
    'Camminarono fino al ponte senza parlare. Sotto, il fiume portava via foglie e pensieri con la stessa indifferenza. «Quando eravamo piccoli» disse Marco «credevo che il ponte si spostasse di notte. Che si mettesse dove voleva, e al mattino tornasse al suo posto facendo finta di niente.» Elena rise, e fu come se qualcosa si sciogliesse.',
    'La sera scese in fretta, ma senza durezza. Le luci si accesero a una a una, e dalle finestre veniva l\'odore del pane e delle minestre. Nessuno aveva fretta di andare a dormire: a volte il giorno ha bisogno di essere accompagnato fino in fondo, come un ospite che si saluta sulla porta.',
  ];

  const pick = (ch, n) => Array.from({ length: n }, (_, i) => P[(ch * 3 + i * 2 + (i % 3)) % P.length]);

  BF.sampleBook = function () {
    const chapters = [];
    const names = ['La lettera', 'Il paese', 'Il ponte', 'La sera', 'Il ritorno'];
    names.forEach((title, ch) => {
      let html = '';
      pick(ch, 9 + ch * 3).forEach((par, i) => {
        html += '<p>' + par + '</p>';
        if (i === 4) html += '<hr>';
        if (i === 6 && ch === 1) html += '<h2>Una nota sul paese</h2>';
        if (i === 7 && ch === 2) html += '<blockquote><p>«Ogni ponte è una promessa che qualcuno ha fatto alla riva opposta.»</p></blockquote>';
      });
      chapters.push({ id: BF.uid(), title, html, include: true });
    });
    return {
      title: 'La pioggia sottile',
      author: 'Autore di prova',
      language: 'it',
      cover: null,
      chapters,
    };
  };
})();
