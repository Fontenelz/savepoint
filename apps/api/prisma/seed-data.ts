/** Catálogo curado local — o app funciona sem nenhuma API externa. */

export const PLATFORMS = [
  { slug: 'pc', name: 'PC', short: 'PC', sortOrder: 1 },
  { slug: 'ps5', name: 'PlayStation 5', short: 'PS5', sortOrder: 2 },
  { slug: 'ps4', name: 'PlayStation 4', short: 'PS4', sortOrder: 3 },
  { slug: 'xsx', name: 'Xbox Series X|S', short: 'XSX', sortOrder: 4 },
  { slug: 'xone', name: 'Xbox One', short: 'XONE', sortOrder: 5 },
  { slug: 'switch', name: 'Nintendo Switch', short: 'Switch', sortOrder: 6 },
  { slug: 'mobile', name: 'iOS / Android', short: 'Mobile', sortOrder: 7 },
  { slug: 'ps3', name: 'PlayStation 3', short: 'PS3', sortOrder: 20 },
  { slug: 'x360', name: 'Xbox 360', short: 'X360', sortOrder: 21 },
  { slug: 'wiiu', name: 'Wii U', short: 'Wii U', sortOrder: 22 },
  { slug: 'snes', name: 'Super Nintendo', short: 'SNES', sortOrder: 30 },
] as const;

export const GENRES = [
  ['acao', 'Ação'],
  ['aventura', 'Aventura'],
  ['rpg', 'RPG'],
  ['plataforma', 'Plataforma'],
  ['metroidvania', 'Metroidvania'],
  ['roguelike', 'Roguelike'],
  ['estrategia', 'Estratégia'],
  ['puzzle', 'Puzzle'],
  ['indie', 'Indie'],
  ['tiro', 'Tiro'],
  ['corrida', 'Corrida'],
  ['luta', 'Luta'],
  ['simulacao', 'Simulação'],
  ['terror', 'Terror'],
  ['narrativo', 'Narrativo'],
  ['mundo-aberto', 'Mundo aberto'],
  ['soulslike', 'Soulslike'],
] as const;

type P = (typeof PLATFORMS)[number]['slug'];
type G = (typeof GENRES)[number][0];

export interface SeedGame {
  slug: string;
  title: string;
  year: number;
  dev: string;
  pub?: string;
  genres: G[];
  platforms: P[];
  hours: number | null;
  /** "Qualidade" usada para gerar notas plausíveis (1–10). */
  q: number;
  summary: string;
}

export const GAMES: SeedGame[] = [
  { slug: 'hollow-knight', title: 'Hollow Knight', year: 2017, dev: 'Team Cherry', genres: ['metroidvania', 'plataforma', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 30, q: 9, summary: 'Um cavaleiro sem nome desce às ruínas de um reino de insetos. Exploração densa, combate preciso e um mapa que você precisa comprar antes de entender.' },
  { slug: 'hollow-knight-silksong', title: 'Hollow Knight: Silksong', year: 2025, dev: 'Team Cherry', genres: ['metroidvania', 'plataforma', 'indie'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch'], hours: 40, q: 9, summary: 'Hornet é levada a um reino desconhecido e precisa escalar até o topo. Mais rápida, mais acrobática e bem mais cruel.' },
  { slug: 'celeste', title: 'Celeste', year: 2018, dev: 'Maddy Makes Games', genres: ['plataforma', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 10, q: 9, summary: 'Madeline decide subir uma montanha. Plataforma milimétrica sobre ansiedade, persistência e morrer mil vezes sem desistir.' },
  { slug: 'hades', title: 'Hades', year: 2020, dev: 'Supergiant Games', genres: ['roguelike', 'acao', 'indie'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch'], hours: 22, q: 9, summary: 'Zagreus tenta fugir do submundo, de novo e de novo. Cada morte avança a história de uma família divina bem disfuncional.' },
  { slug: 'elden-ring', title: 'Elden Ring', year: 2022, dev: 'FromSoftware', pub: 'Bandai Namco', genres: ['rpg', 'soulslike', 'mundo-aberto'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone'], hours: 60, q: 9, summary: 'As Terras Intermédias esperam um Maculado. Mundo aberto gigantesco, chefes memoráveis e a liberdade de ir para onde quiser — inclusive para a morte.' },
  { slug: 'the-witcher-3-wild-hunt', title: 'The Witcher 3: Wild Hunt', year: 2015, dev: 'CD Projekt Red', genres: ['rpg', 'mundo-aberto'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch'], hours: 52, q: 9, summary: 'Geralt procura Ciri por um continente em guerra. Missões secundárias com mais roteiro que muitos jogos inteiros.' },
  { slug: 'red-dead-redemption-2', title: 'Red Dead Redemption 2', year: 2018, dev: 'Rockstar Games', genres: ['acao', 'aventura', 'mundo-aberto'], platforms: ['pc', 'ps4', 'xone'], hours: 50, q: 9, summary: 'O fim do Velho Oeste pelos olhos de Arthur Morgan e da gangue Van der Linde. Lento de propósito, devastador no final.' },
  { slug: 'zelda-breath-of-the-wild', title: 'The Legend of Zelda: Breath of the Wild', year: 2017, dev: 'Nintendo', genres: ['aventura', 'mundo-aberto'], platforms: ['switch', 'wiiu'], hours: 50, q: 9, summary: 'Link acorda sem memória num Hyrule em ruínas. Se você vê uma montanha, pode escalar.' },
  { slug: 'zelda-tears-of-the-kingdom', title: 'The Legend of Zelda: Tears of the Kingdom', year: 2023, dev: 'Nintendo', genres: ['aventura', 'mundo-aberto'], platforms: ['switch'], hours: 60, q: 9, summary: 'Hyrule agora tem céu e subsolo. E você pode colar qualquer coisa em qualquer coisa.' },
  { slug: 'disco-elysium', title: 'Disco Elysium', year: 2019, dev: 'ZA/UM', genres: ['rpg', 'narrativo'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch'], hours: 24, q: 9, summary: 'Um detetive acorda de ressaca, sem nome e sem dignidade. Um RPG em que suas habilidades discutem entre si.' },
  { slug: 'outer-wilds', title: 'Outer Wilds', year: 2019, dev: 'Mobius Digital', pub: 'Annapurna Interactive', genres: ['aventura', 'puzzle', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 17, q: 10, summary: 'Um sistema solar em miniatura e um loop de 22 minutos. O único progresso é o que você aprende. Jogue sem ler nada.' },
  { slug: 'stardew-valley', title: 'Stardew Valley', year: 2016, dev: 'ConcernedApe', genres: ['simulacao', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch', 'mobile'], hours: 53, q: 8, summary: 'Você largou o escritório para cuidar da fazenda do avô. Plantar, pescar, fazer amigos e perder a noção do tempo.' },
  { slug: 'baldurs-gate-3', title: "Baldur's Gate 3", year: 2023, dev: 'Larian Studios', genres: ['rpg', 'estrategia'], platforms: ['pc', 'ps5', 'xsx'], hours: 75, q: 9, summary: 'Um girino na sua cabeça e um grupo de companheiros questionáveis. Cada escolha tem consequência — e o dado sempre decide.' },
  { slug: 'god-of-war-2018', title: 'God of War', year: 2018, dev: 'Santa Monica Studio', pub: 'Sony Interactive Entertainment', genres: ['acao', 'aventura'], platforms: ['ps4', 'pc'], hours: 21, q: 9, summary: 'Kratos, agora pai, atravessa a mitologia nórdica com o filho Atreus para espalhar as cinzas da mãe.' },
  { slug: 'portal-2', title: 'Portal 2', year: 2011, dev: 'Valve', genres: ['puzzle'], platforms: ['pc', 'ps3', 'x360'], hours: 8, q: 9, summary: 'Chell volta ao laboratório da Aperture. Quebra-cabeças com portais, gel e o melhor humor do gênero.' },
  { slug: 'minecraft', title: 'Minecraft', year: 2011, dev: 'Mojang Studios', genres: ['simulacao', 'mundo-aberto'], platforms: ['pc', 'ps4', 'xone', 'switch', 'mobile'], hours: null, q: 8, summary: 'Blocos, ferramentas e um mundo infinito. Sobreviva à primeira noite e depois construa o que imaginar.' },
  { slug: 'dark-souls', title: 'Dark Souls', year: 2011, dev: 'FromSoftware', pub: 'Bandai Namco', genres: ['rpg', 'soulslike'], platforms: ['pc', 'ps3', 'x360'], hours: 42, q: 9, summary: 'Lordran é um labirinto interligado de morte e fogueiras. O jogo que fundou um gênero.' },
  { slug: 'bloodborne', title: 'Bloodborne', year: 2015, dev: 'FromSoftware', pub: 'Sony Interactive Entertainment', genres: ['acao', 'soulslike', 'terror'], platforms: ['ps4'], hours: 34, q: 9, summary: 'Uma caçada em Yharnam vira horror cósmico. Agressivo, gótico e sem escudo para se esconder.' },
  { slug: 'sekiro', title: 'Sekiro: Shadows Die Twice', year: 2019, dev: 'FromSoftware', pub: 'Activision', genres: ['acao', 'soulslike'], platforms: ['pc', 'ps4', 'xone'], hours: 30, q: 9, summary: 'Um shinobi no Japão Sengoku. O combate é um ritmo de aparos — aprenda a dança ou morra.' },
  { slug: 'persona-5-royal', title: 'Persona 5 Royal', year: 2020, dev: 'Atlus', genres: ['rpg'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch'], hours: 100, q: 9, summary: 'De dia, estudante em Tóquio. De noite, ladrão de corações em palácios cognitivos. Estiloso do menu ao último chefe.' },
  { slug: 'final-fantasy-vii-remake', title: 'Final Fantasy VII Remake', year: 2020, dev: 'Square Enix', genres: ['rpg', 'acao'], platforms: ['pc', 'ps5', 'ps4'], hours: 33, q: 8, summary: 'Midgar reimaginada em detalhes. Combate híbrido e uma história que sabe que você conhece o original.' },
  { slug: 'undertale', title: 'Undertale', year: 2015, dev: 'Toby Fox', genres: ['rpg', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 6, q: 9, summary: 'Uma criança cai no mundo dos monstros. Você não precisa matar ninguém — e o jogo lembra de tudo.' },
  { slug: 'inside', title: 'Inside', year: 2016, dev: 'Playdead', genres: ['puzzle', 'plataforma', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 3.5, q: 8, summary: 'Um garoto corre por um mundo cinzento e opressor. Sem diálogo, sem explicação, com um final que ninguém esquece.' },
  { slug: 'dead-cells', title: 'Dead Cells', year: 2018, dev: 'Motion Twin', genres: ['roguelike', 'metroidvania', 'acao'], platforms: ['pc', 'ps4', 'xone', 'switch', 'mobile'], hours: 25, q: 8, summary: 'Uma massa de células possui um corpo e tenta sair de uma ilha amaldiçoada. Combate rápido e builds que mudam a cada run.' },
  { slug: 'slay-the-spire', title: 'Slay the Spire', year: 2019, dev: 'Mega Crit', genres: ['roguelike', 'estrategia', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch', 'mobile'], hours: 30, q: 9, summary: 'Monte um baralho enquanto sobe a torre. O roguelike de cartas que inspirou dezenas de outros.' },
  { slug: 'cyberpunk-2077', title: 'Cyberpunk 2077', year: 2020, dev: 'CD Projekt Red', genres: ['rpg', 'tiro', 'mundo-aberto'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone'], hours: 26, q: 8, summary: 'V tem um chip com a consciência de um astro do rock morto. Night City é linda, perigosa e não liga para você.' },
  { slug: 'resident-evil-4-2023', title: 'Resident Evil 4', year: 2023, dev: 'Capcom', genres: ['terror', 'acao'], platforms: ['pc', 'ps5', 'ps4', 'xsx'], hours: 16, q: 9, summary: 'Leon vai à Espanha resgatar a filha do presidente. O remake mantém o ritmo e moderniza tudo em volta.' },
  { slug: 'alan-wake-2', title: 'Alan Wake 2', year: 2023, dev: 'Remedy Entertainment', pub: 'Epic Games', genres: ['terror', 'narrativo'], platforms: ['pc', 'ps5', 'xsx'], hours: 18, q: 8, summary: 'Uma agente do FBI investiga assassinatos rituais enquanto um escritor tenta reescrever a própria saída de um pesadelo.' },
  { slug: 'super-mario-odyssey', title: 'Super Mario Odyssey', year: 2017, dev: 'Nintendo', genres: ['plataforma', 'aventura'], platforms: ['switch'], hours: 12, q: 9, summary: 'Mario e um chapéu vivo viajam o mundo atrás de Bowser. Cada reino é um parque de diversões de luas escondidas.' },
  { slug: 'mario-kart-8-deluxe', title: 'Mario Kart 8 Deluxe', year: 2017, dev: 'Nintendo', genres: ['corrida'], platforms: ['switch'], hours: null, q: 8, summary: 'O kart definitivo para jogar no sofá — e para destruir amizades com um casco azul.' },
  { slug: 'street-fighter-6', title: 'Street Fighter 6', year: 2023, dev: 'Capcom', genres: ['luta'], platforms: ['pc', 'ps5', 'ps4', 'xsx'], hours: null, q: 8, summary: 'A série volta com controles modernos para iniciantes, um modo aventura curioso e um competitivo afiadíssimo.' },
  { slug: 'balatro', title: 'Balatro', year: 2024, dev: 'LocalThunk', pub: 'Playstack', genres: ['roguelike', 'estrategia', 'indie'], platforms: ['pc', 'ps5', 'ps4', 'xsx', 'xone', 'switch', 'mobile'], hours: 13, q: 9, summary: 'Pôquer roguelike com coringas que quebram as regras. "Só mais uma rodada" às 3h da manhã.' },
  { slug: 'astro-bot', title: 'Astro Bot', year: 2024, dev: 'Team Asobi', pub: 'Sony Interactive Entertainment', genres: ['plataforma'], platforms: ['ps5'], hours: 11, q: 9, summary: 'Um robozinho resgata a tripulação espalhada pela galáxia. Pura alegria de plataforma 3D.' },
  { slug: 'metaphor-refantazio', title: 'Metaphor: ReFantazio', year: 2024, dev: 'Studio Zero', pub: 'Atlus', genres: ['rpg'], platforms: ['pc', 'ps5', 'ps4', 'xsx'], hours: 80, q: 8, summary: 'Uma eleição pelo trono de um reino fantástico. RPG por turnos com calendário, ansiedade e política.' },
  { slug: 'animal-well', title: 'Animal Well', year: 2024, dev: 'Billy Basso', pub: 'Bigmode', genres: ['metroidvania', 'puzzle', 'indie'], platforms: ['pc', 'ps5', 'xsx', 'switch'], hours: 8, q: 8, summary: 'Um poço cheio de animais estranhos e segredos em camadas. Quando você acha que acabou, mal começou.' },
  { slug: 'hi-fi-rush', title: 'Hi-Fi Rush', year: 2023, dev: 'Tango Gameworks', pub: 'Bethesda', genres: ['acao'], platforms: ['pc', 'ps5', 'xsx'], hours: 11, q: 8, summary: 'Chai ganha um music player no peito e o mundo passa a seguir o ritmo. Pancadaria no tempo da batida.' },
  { slug: 'chrono-trigger', title: 'Chrono Trigger', year: 1995, dev: 'Square', genres: ['rpg'], platforms: ['snes', 'pc', 'mobile'], hours: 24, q: 9, summary: 'Uma feira, um portal e uma viagem pelo tempo para impedir o fim do mundo. Um clássico com múltiplos finais.' },
  { slug: 'horizon-chase-turbo', title: 'Horizon Chase Turbo', year: 2018, dev: 'Aquiris', genres: ['corrida', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch'], hours: 15, q: 8, summary: 'Homenagem brasileira aos arcades de corrida dos anos 90. Cores saturadas, trilha sintetizada e pistas pelo mundo.' },
  { slug: 'dandara', title: 'Dandara', year: 2018, dev: 'Long Hat House', genres: ['metroidvania', 'plataforma', 'indie'], platforms: ['pc', 'ps4', 'xone', 'switch', 'mobile'], hours: 8, q: 7, summary: 'Metroidvania mineiro em que você não anda: salta entre superfícies. Inspirado na guerreira Dandara dos Palmares.' },
  { slug: 'clair-obscur-expedition-33', title: 'Clair Obscur: Expedition 33', year: 2025, dev: 'Sandfall Interactive', pub: 'Kepler Interactive', genres: ['rpg'], platforms: ['pc', 'ps5', 'xsx'], hours: 35, q: 9, summary: 'Todo ano a Pintora apaga quem tem certa idade. A Expedição 33 parte para acabar com isso. Turnos com reflexos em tempo real.' },
];

export const USERS = [
  { username: 'demo', displayName: 'Demo', hue: 88, bio: 'Conta de demonstração. Pode bagunçar à vontade.' },
  { username: 'ana', displayName: 'Ana Ribeiro', hue: 330, bio: 'Zero tudo que tem pixel art. Backlog infinito, coração também.' },
  { username: 'bruno', displayName: 'Bruno Kato', hue: 12, bio: 'Soulslike até o osso. Sim, eu uso escudo. Não, não me julgue.' },
  { username: 'carol', displayName: 'Carol Mendes', hue: 265, bio: 'RPG de 100h? Só se for agora. Faço todas as side quests.' },
  { username: 'davi', displayName: 'Davi Lopes', hue: 195, bio: 'Speedrunner aposentado. Ainda conto frames de cabeça.' },
  { username: 'elis', displayName: 'Elis Martins', hue: 150, bio: 'Jogo pra relaxar. Stardew é terapia, Balatro é recaída.' },
];

/** Preferências de cada usuário (gêneros favoritos) para gerar estantes coerentes. */
export const TASTES: Record<string, G[]> = {
  demo: ['indie', 'rpg', 'aventura'],
  ana: ['indie', 'plataforma', 'metroidvania', 'puzzle'],
  bruno: ['soulslike', 'acao', 'rpg'],
  carol: ['rpg', 'narrativo', 'mundo-aberto'],
  davi: ['plataforma', 'corrida', 'luta', 'acao'],
  elis: ['simulacao', 'roguelike', 'estrategia', 'indie'],
};

export const REVIEWS = {
  high: [
    'Terminei e fiquei olhando os créditos em silêncio. Faz tempo que um jogo não me pegava assim.',
    'Level design de livro didático. Cada sala ensina algo sem dizer uma palavra.',
    'O tipo de jogo que te faz esquecer de jantar. Duas vezes.',
    'Trilha sonora ainda tocando na minha cabeça três dias depois.',
    'Rejogando e descobrindo coisas que passaram batido na primeira vez. Que cuidado nos detalhes.',
    'Chorei? Chorei. Recomendo? Com todas as forças.',
    'Comecei pelo hype, fiquei pelo carinho em cada canto do mapa.',
    'Perfeito do primeiro ao último minuto. Agora preciso de um jogo novo e de terapia.',
    'Controle tão bom que quando eu morro a culpa é 100% minha. E eu volto feliz.',
    'Obra-prima. Simples assim.',
  ],
  mid: [
    'Bonito e bem feito, mas me perdeu um pouco no terceiro ato.',
    'Gostei bastante, só achei que podia ter umas 10 horas a menos.',
    'Divertido em doses pequenas. Maratonar cansou.',
    'Ótimas ideias, execução irregular. Ainda assim vale a visita.',
    'O começo é lento, mas quando engrena vai longe.',
    'Não é pra mim, mas entendo totalmente quem ama.',
  ],
  low: [
    'Larguei na metade. Talvez volte. Talvez.',
    'Queria muito gostar. Não rolou.',
    'Muita promessa, pouco jogo. Fiquei no menu mais tempo do que jogando.',
  ],
} as const;

export const LISTS = [
  {
    owner: 'carol',
    title: 'RPGs que valem cada hora',
    description: 'Jogos longos que nunca pareceram longos. Em ordem de quanto eu choraria se perdesse o save.',
    ranked: true,
    games: ['disco-elysium', 'baldurs-gate-3', 'the-witcher-3-wild-hunt', 'persona-5-royal', 'chrono-trigger', 'clair-obscur-expedition-33', 'metaphor-refantazio', 'final-fantasy-vii-remake'],
  },
  {
    owner: 'ana',
    title: 'Indies brasileiros (e vizinhos de espírito)',
    description: 'Feitos aqui ou com aquele jeitinho de estúdio pequeno que faz muito com pouco.',
    ranked: false,
    games: ['horizon-chase-turbo', 'dandara', 'celeste', 'hollow-knight', 'animal-well', 'undertale'],
  },
  {
    owner: 'davi',
    title: 'Pra zerar num fim de semana',
    description: 'Menos de 15 horas, começo-meio-fim, zero culpa.',
    ranked: false,
    games: ['inside', 'portal-2', 'celeste', 'undertale', 'animal-well', 'hi-fi-rush', 'astro-bot', 'super-mario-odyssey'],
  },
  {
    owner: 'bruno',
    title: 'Soulslike: do mais acessível ao mais cruel',
    description: 'Ordem recomendada pra quem quer entrar no gênero sem quebrar o controle.',
    ranked: true,
    games: ['elden-ring', 'dark-souls', 'bloodborne', 'hollow-knight', 'sekiro', 'hollow-knight-silksong'],
  },
  {
    owner: 'elis',
    title: 'Só mais uma run',
    description: 'Roguelikes e afins que roubaram meu sono.',
    ranked: false,
    games: ['balatro', 'slay-the-spire', 'hades', 'dead-cells', 'stardew-valley'],
  },
];
