import { THINKING_COPY } from '@dear-steven/core/copy';
import { brand } from '../brand';
import type { Messages } from './en';

/** German (P6-02). Informal "du", like the persona's English; German quotes and number format. */
const n = (x: number) => x.toLocaleString('de-DE');
const s = (x: number, one: string, other: string) => `${n(x)} ${x === 1 ? one : other}`;
const dec = (x: number) =>
  x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const de: Messages = {
  meta: {
    description:
      'Eine KI-Persona von Steven Bartlett, die aus echten Gesprächen von The Diary Of A CEO antwortet — und dir genau zeigt, wo jede Idee gesagt wurde.',
    termsTitle: `Nutzungsbedingungen, Haftungsausschluss und Datenschutz · ${brand.name}`,
    termsDescription:
      'Was Dear Steven ist und was nicht, die Bedingungen für die Nutzung und was mit deinen Daten passiert.',
  },
  home: {
    intro:
      'Setz dich zu mir. Frag mich, was du willst — ich antworte aus den Gesprächen, die ich geführt habe, und zeige dir genau, woher jede Idee kommt.',
    examplesLabel: 'Beispielfragen',
    examples: [
      'Ich schiebe ein wichtiges Projekt seit Wochen vor mir her. Wie würdest du es angehen?',
      'Wie bleibe ich diszipliniert, wenn die Motivation nachlässt?',
      'Worüber sollte ich gründlich nachdenken, bevor ich ein Unternehmen gründe?',
    ],
    shortcuts: '↵ fragen · ⇧↵ neue Zeile · / zum Tippen · [ ] Quellen',
  },
  composer: {
    label: 'Frag Steven',
    placeholder: 'Dear Steven…',
    followUp: 'Stell eine Anschlussfrage…',
    listening: 'Ich höre zu…',
    send: 'Senden',
    stop: 'Stoppen',
  },
  disclosure:
    'Dear Steven ist eine KI-Persona — nicht Steven Bartlett und nicht mit der Show verbunden.',
  terms: {
    link: 'Bedingungen & Haftungsausschluss',
    noticeLabel: 'Bevor du anfängst',
    notice:
      'Ich bin eine KI-Persona — nicht Steven Bartlett und nicht mit der Show verbunden. Ich antworte aus öffentlichen Interviews, ich kann mich irren, und nichts, was ich sage, ist medizinische, rechtliche oder finanzielle Beratung.',
    dismiss: 'Verstanden',
  },
  status: {
    ready: (x) => `${s(x, 'Gespräch', 'Gespräche')} · bereit`,
    demo: 'Demo-Modus · Beispielantworten',
    empty: 'Noch keine Gespräche indexiert',
    partial: (x) => `${n(x)} indexiert · Embeddings ausstehend`,
    broken: 'Wissensbasis nicht verfügbar',
    short: {
      ready: (x) => `${n(x)} · bereit`,
      demo: 'Demo-Modus',
      empty: 'Nicht indexiert',
      partial: 'Indexiere',
      broken: 'Offline',
    },
    open: '. Einrichtung und Details zur Wissensbasis öffnen.',
  },
  thinking: {
    ...THINKING_COPY.de,
    stopped: 'Gestoppt nach',
    interrupted: 'Unterbrochen nach',
    elapsed: (seconds) =>
      seconds < 60 ? `${dec(seconds)} s` : `${Math.floor(seconds / 60)} min ${dec(seconds % 60)} s`,
    elapsedSpoken: (seconds) =>
      seconds < 60
        ? `${dec(seconds)} Sekunden`
        : `${Math.floor(seconds / 60)} Minuten ${dec(seconds % 60)} Sekunden`,
  },
  stage: {
    voiceSettings: 'Stimme und Sprache',
    voice: 'Stimme',
    about: 'Info',
    howItWorks: 'So funktioniert’s',
    newConversation: 'Neues Gespräch beginnen',
    newConversationSr: ' — neues Gespräch beginnen',
    restoredTitle: 'Da weitergemacht, wo du aufgehört hast',
    restoredBody:
      'Dieses Gespräch wird auf diesem Gerät gespeichert. Am Ende der Seite kannst du es vergessen lassen.',
    endedEarly: 'Die Antwort brach vorzeitig ab.',
  },
  demoNotice: {
    title: 'Demo — nicht von KI erzeugt und nicht quellengeprüft',
    description:
      'Diese Antworten sind Beispiele, damit du das Erlebnis ausprobieren kannst. Füge einen OpenAI-Schlüssel hinzu, um wirklich zu sprechen.',
    action: 'Einrichten',
  },
  errors: {
    network: 'Die Verbindung war kurz weg. Versuchst du es noch einmal?',
    rateLimited:
      'Du fragst schneller, als ich denken kann. Warte einen Moment und versuch es dann noch einmal.',
    upstream:
      'Meine Seite des Gesprächs ist abgebrochen. Nichts wurde erfunden — versuch es gleich noch einmal.',
    generic: 'Bei mir ist etwas schiefgelaufen. Noch einmal versuchen?',
    notConfigured: 'Ich bin noch nicht so eingerichtet, dass ich richtig antworten kann.',
    locked:
      'Diese Kopie von mir ist privat. Lade die Seite neu und gib den Zugangscode noch einmal ein.',
    passage: 'Diese Passage konnte ich gerade nicht laden.',
    micDenied:
      'Ich kann dich nicht hören — der Mikrofonzugriff ist blockiert. Du kannst stattdessen tippen oder das Mikrofon in den Browsereinstellungen erlauben.',
    micUnsupported:
      'Dieser Browser kann hier keine Spracheingabe. Tippen funktioniert genauso gut.',
    clipboard: 'Die Zwischenablage war nicht erreichbar',
  },
  serverErrors: {
    keyRejected:
      'Der OpenAI-Schlüssel wurde abgelehnt. Prüfe OPENAI_API_KEY in der .env und starte neu.',
    rateLimited: 'OpenAI drosselt diesen Schlüssel, oder das Guthaben ist aufgebraucht.',
    providerDown: 'OpenAI hatte gerade ein Problem beim Antworten.',
    refused: 'OpenAI hat die Anfrage abgelehnt.',
    unreachable: 'Ich konnte OpenAI gerade nicht erreichen.',
    internal: 'Bei mir ist etwas schiefgelaufen.',
    noKey: 'Es ist kein OpenAI-Schlüssel eingerichtet.',
    noKnowledgeBase: 'Die Wissensbasis konnte nicht geöffnet werden.',
  },
  voiceErrors: {
    noSpeech: 'Das habe ich nicht verstanden.',
    noSpeechHint: 'Versuch es etwas näher am Mikrofon — oder tippe stattdessen.',
    unclear: 'Das konnte ich nicht verstehen.',
    serviceDown:
      'Der Spracherkennungsdienst deines Browsers ist nicht erreichbar, deshalb nutze ich jetzt die Transkription auf dem Server. Versuch es noch einmal.',
    stopped: 'Die Spracherkennung wurde unerwartet beendet.',
    recording: 'Die Aufnahme konnte nicht transkribiert werden.',
  },
  empty: {
    noKnowledge:
      'Noch ist nichts geladen. Führe den Ingest-Befehl aus, dann habe ich etwas zu sagen — siehe „Einrichten“.',
  },
  turn: {
    demoTag: 'Demo-Beispiel · nicht von KI erzeugt und nicht quellengeprüft',
    spokenHeading: 'Was ich laut sagen würde',
    spokenNote: 'Die geschriebene Antwort enthält die Quellen.',
    stopped: 'Du hast mich unterbrochen. Frag jederzeit noch einmal.',
    retry: 'Noch einmal versuchen',
    complete: 'Antwort fertig.',
  },
  answer: {
    takeaway: 'An deiner Stelle',
    translation: 'Übersetzung',
    verbatim: 'wörtlich aus dem Transkript',
    notVerified: 'Sprecher nicht bestätigt',
    openSource: '. Quelle öffnen.',
    fromMyConversation: (who) => `Aus meinem Gespräch mit ${who}`,
    onTheShow: (who) => `${who}, in der Show`,
    listen: 'Anhören',
    stop: 'Stoppen',
    viewLabel: 'Ansicht der Antwort',
    written: 'Geschrieben',
    spoken: 'Gesprochen',
  },
  speaker: {
    hostLong: `${brand.host.fullName} (Gastgeber) — bestätigter Sprecher`,
    guestLong: (name) => `${name} — bestätigter Sprecher`,
    unverifiedLong: (guest) => `Aus dem Gespräch mit ${guest} — Sprecher nicht bestätigt`,
    guest: 'Gast',
    unknown: 'Unbekannt',
  },
  chip: {
    host: 'Bestätigte Aussage des Gastgebers',
    guest: 'Bestätigte Aussage eines Gasts',
    unverified: 'Echte Passage, Sprecher nicht bestätigt',
    label: (who, time, note, spoken) => `${who} · ${time}. ${note}, bei ${spoken}. Quelle öffnen.`,
  },
  cards: {
    label: 'Zitierte Gespräche',
    heading: (count) => (count === 1 ? 'Aus diesem Gespräch' : `Aus diesen ${count} Gesprächen`),
    moments: (count) => s(count, 'Moment', 'Momente'),
  },
  youtube: {
    watch: 'Auf YouTube ansehen',
    watchFrom: (moment) => `Auf YouTube ansehen · ${moment.replace(' ', '\u00a0')}`,
    newTab: ' — öffnet YouTube in einem neuen Tab',
    unmatched: 'Noch kein Video zugeordnet',
    fixture: 'Beispiel · kein Video',
    invitation:
      'Diese Gespräche lohnen sich in voller Länge — sie gehen weiter als jede Antwort, die ich geben kann.',
    channel: 'The Diary Of A CEO auf YouTube',
  },
  inspector: {
    label: 'Quellenansicht',
    position: (index, total) => `${index} von ${total}`,
    previous: 'Vorherige Quelle ( [ )',
    next: 'Nächste Quelle ( ] )',
    close: 'Schließen (Esc)',
    fromConversation: (who) => `Aus dem Gespräch mit ${who}`,
    saidBy: (who) => `Gesagt von ${who}`,
    inPodcast: (time) => `bei ${time} im Podcast`,
    tabsLabel: 'Ansicht der Quelle',
    tabs: { quote: 'Zitat', context: 'Kontext', video: 'Video' },
    verifiedHost: 'Bestätigter Gastgeber',
    verifiedGuest: 'Bestätigter Gast',
    notVerified: 'Sprecher nicht bestätigt',
    verbatim: 'Wörtlich aus dem gespeicherten Transkript',
    asr: ' · automatische Transkription, kann Fehler enthalten',
    unverifiedNote:
      ' · die Passage ist echt, aber das Transkript sagt nicht, wer gerade gesprochen hat',
    whyCited: 'Warum ich das zitiere',
    aiNote: 'Eine KI-Notiz, nicht Teil des Transkripts.',
    copy: 'Zitat mit Quellenangabe kopieren',
    copied: 'Zitat mit Quellenangabe kopiert',
    copyConversation: ' (Gespräch)',
  },
  related: {
    heading: 'Verwandte Momente',
    note: 'Aus anderen Gesprächen. Verwandt, nicht zitiert — sie stützen diese Antwort nicht.',
  },
  video: {
    demoOff:
      'Im Demo-Modus sind Videolinks ausgeschaltet — Demo-Folgen sind Beispiele, keine echten Aufnahmen.',
    notLinked:
      'Diese Folge ist noch nicht mit ihrem YouTube-Video verknüpft. Führe den Ingest-Schritt match-youtube aus, um das nachzuholen.',
    notLinkedAudio:
      'Diese Folge ist noch nicht mit ihrem YouTube-Video verknüpft — das Podcast-Audio findest du unten.',
    playFrom: (moment) => `Video hier ab ${moment} abspielen`,
    play: 'Video hier abspielen',
    privacy:
      'Der datenschutzfreundliche Player von YouTube. Von Google wird erst etwas geladen, wenn du auf Abspielen drückst.',
    frameTitle: (title) => `YouTube-Video: ${title}`,
    exact: 'Video und Podcast sind für diese Folge abgeglichen.',
    estimated:
      'Ungefähr (≈) — das Video kann dem Podcast-Audio etwas voraus sein oder hinterherhinken.',
    unaligned: (time) =>
      `Der genaue Moment ist noch nicht abgeglichen, deshalb startet das Video am Anfang. Im Podcast ist es bei ${time}.`,
    audioHeading: 'Podcast-Audio',
    playAudioFrom: (time) => `Podcast-Audio hier ab ${time} abspielen`,
    retryAudio: 'Podcast-Audio noch einmal versuchen',
    audioError: 'Der Podcast-Host hat das Audio gerade nicht geliefert.',
    audioNote:
      'Wird vom Host des Podcasts gestreamt, sobald du auf Abspielen drückst. Werbung, die der Host einfügt, kann den Moment um ein paar Sekunden verschieben.',
  },
  setup: {
    eyebrow: 'Einrichtung',
    title: 'Womit ich arbeiten kann',
    optional: 'optional',
    marks: {
      pending: 'Ausstehend',
      running: 'Läuft',
      done: 'Erledigt',
      failed: 'Fehlgeschlagen',
      cancelled: 'Abgebrochen',
    },
    openai: {
      title: 'OpenAI-API-Schlüssel',
      forced: 'Gefunden, aber `DEAR_STEVEN_DEMO=1` erzwingt den Demo-Modus.',
      found: 'Auf dem Server gefunden. Er gelangt nie in den Browser.',
      missing:
        'Fehlt — die Antworten sind Demo-Beispiele, bis du `OPENAI_API_KEY` in die `.env` im Wurzelverzeichnis des Repositorys einträgst und neu startest.',
    },
    kb: {
      title: 'Wissensbasis',
      error: (detail) => `Die Datenbank konnte nicht geöffnet werden: ${detail}`,
      none: 'Noch keine Datenbank. Beginne mit `pnpm ingest discover`, dann `pnpm ingest transcribe --from vtt --limit 20`.',
      ready: (episodes, passages, lastRun) =>
        `${s(episodes, 'Folge', 'Folgen')} · ${s(passages, 'Passage', 'Passagen')} indexiert${lastRun ? ` · letzter Lauf ${lastRun}` : ''}.`,
    },
    embeddings: {
      title: 'Semantische Suche',
      waiting: 'Warte auf Passagen.',
      done: 'Jede Passage hat ein Embedding; die Suche ist hybrid (Bedeutung + Stichwörter).',
      partial: (embedded, total) =>
        `${n(embedded)} von ${n(total)} Passagen mit Embedding — die Stichwortsuche deckt den Rest ab. Führe \`pnpm ingest index\` aus.`,
    },
    youtube: {
      title: 'YouTube-Momente',
      done: (x) => `${s(x, 'Folge', 'Folgen')} mit ihren Videos verknüpft.`,
      missing:
        'Optional. Füge `YOUTUBE_API_KEY` hinzu und führe `pnpm ingest match-youtube` aus, damit Zitate das Video an der richtigen Stelle öffnen.',
    },
    spend: {
      title: 'Tägliches Ausgabenlimit',
      none: (today) =>
        `Kein Limit: heute ${today} ausgegeben (geschätzt). Setze \`DEAR_STEVEN_DAILY_BUDGET_USD\`, bevor andere das hier erreichen können.`,
      resting: (cap) =>
        `Pause bis Mitternacht UTC: Das heutige Budget von ${cap} ist aufgebraucht, deshalb antworte ich, ohne OpenAI aufzurufen.`,
      within: (today, cap) =>
        `Heute ${today} von ${cap} ausgegeben (geschätzt aus dem Tokenverbrauch).`,
    },
    speakers: {
      title: 'Bestätigte Sprecher',
      done: (x) =>
        `${s(x, 'Folge hat', 'Folgen haben')} Sprecherlabels, also kann ich sagen, wer was gesagt hat.`,
      missing:
        'Optional, kostenpflichtig. Ohne Sprecherlabels zitiere ich das Gespräch, nie eine Person. Siehe `plan/human/transcription-budget.md`.',
    },
    browse: (x) => `${x === 1 ? 'Das Gespräch' : `Die ${n(x)} Gespräche`} durchsuchen`,
    footer:
      'Vollständige Anleitung: `README.md` und `docs/INGESTION.md`. Was du fragst, wird nicht gespeichert.',
  },
  explorer: {
    eyebrow: 'Wissensbasis',
    title: 'Die Gespräche, die ich kenne',
    search: 'Nach Gast oder Titel suchen',
    clear: 'Suche leeren',
    matches: (x) => s(x, 'Treffer', 'Treffer'),
    indexed: (x) => `${s(x, 'Gespräch', 'Gespräche')} indexiert`,
    looking: 'Suche…',
    loadError: 'Die Liste konnte ich gerade nicht laden.',
    noMatch: (q) => `Kein Gespräch passt zu „${q}“.`,
    more: (x) => `Mehr anzeigen (noch ${n(x)})`,
    loading: 'Lade…',
    guestNotNamed: 'Gast nicht genannt',
    passages: (x) => s(x, 'Passage', 'Passagen'),
    verified: 'Sprecher bestätigt',
    notVerified: 'Sprecher nicht bestätigt',
  },
  memory: {
    label: 'Gesprächsgedächtnis',
    remember: 'Dieses Gespräch auf diesem Gerät merken',
    unsupported:
      'Dieser Browser lässt mich nichts speichern, deshalb kann ich mir dieses Gespräch nicht merken.',
    saveFailed:
      'Ich konnte gerade nicht im Speicher dieses Browsers sichern. Neues wird nicht aufbewahrt.',
    on: 'Im eigenen Speicher dieses Browsers aufbewahrt, nur auf diesem Gerät, bis du es vergessen lässt. Wird nirgendwohin gesendet.',
    forgotten: 'Vergessen — von diesem Gespräch ist auf diesem Gerät nichts gespeichert.',
    off: 'Aus: Sobald du diesen Tab schließt, bleibt nichts erhalten.',
    forget: 'Vergessen',
    undo: 'Rückgängig',
    done: 'Vergessen',
  },
  about: {
    eyebrow: 'So funktioniert’s',
    title: 'Eine KI-Persona mit Belegen',
    intro: `${brand.name} antwortet in der ersten Person, im Geist von ${brand.host.fullName}s öffentlicher Interview-Persona. Es ist eine KI — nicht ${brand.host.firstName} und nicht mit ${brand.show} verbunden. Ihr Wissen stammt aus Transkripten echter Folgen, und jede Aussage, die sie jemandem zuschreibt, verweist auf genau die Passage, aus der sie stammt.`,
    kinds: 'Vier Arten von Aussagen',
    host: {
      title: 'Etwas, das der Gastgeber tatsächlich gesagt hat',
      body: 'Nur wenn das Transkript bestätigte Sprecherlabels hat.',
    },
    guest: {
      chip: 'Gast',
      title: 'Etwas, das ein Gast tatsächlich gesagt hat',
      body: 'Setzt ebenfalls bestätigte Sprecherlabels voraus.',
    },
    episode: {
      chip: 'Folge',
      title: 'Aus einem echten Gespräch — Sprecher nicht bestätigt',
      body: 'Die Passage ist echt; das Transkript sagt nur nicht, wer gerade gesprochen hat.',
    },
    synthesis: {
      chip: 'Hellerer Text, ohne Chip',
      title: 'Meine eigenen Überlegungen',
      body: 'Synthese und Rat. Nie als etwas dargestellt, das jemand gesagt hat.',
    },
    checkedHeading: 'Geprüft, nicht geglaubt',
    checked:
      'Das Modell schreibt nie selbst Zitatmarkierungen. Es liefert eine strukturierte Antwort, und der Server prüft jedes Zitat gegen die Passagen, die tatsächlich gefunden wurden: Unbekannte Quellen werden verworfen, Angaben zum Sprecher müssen zum Transkript passen, und Zitate werden aus dem gespeicherten Transkript angezeigt — nie aus dem Gedächtnis des Modells. Wenn die Gespräche deine Frage nicht abdecken, sagt es das.',
    originalsHeading: 'Schau dir die Originale an',
    originals: `Alles hier stammt aus den Gesprächen von ${brand.show}, und die kannst du kostenlos auf YouTube ansehen. Das ist ein Fanprojekt, das Menschen zur Show schickt, kein Ersatz dafür: Wo eine Folge ihrem Video zugeordnet ist, verlinken ihre Quellen auf den Moment, aus dem sie stammen, und die ganzen Folgen anzusehen ist die beste Art, die Menschen zu unterstützen, die sie gemacht haben.`,
    dataHeading: 'Deine Daten',
    data: 'Fragen werden an den Server und an OpenAI gesendet, um eine Antwort zu formulieren, und nicht gespeichert, es sei denn, wer diese Kopie betreibt, schaltet das Protokollieren von Antworten zur Auswertung ein. Das Mikrofon wird nur benutzt, solange du es gedrückt hältst oder einschaltest. Kurze Zitate mit Quellenangabe verweisen auf die Originalfolgen; vollständige Transkripte werden nie veröffentlicht. Videoplayer und Podcast-Audio laden erst dann von YouTube und vom Host des Podcasts, wenn du auf Abspielen drückst. Wenn du eine Sprache wählst, merkt sich ein kleines Cookie diese Wahl, damit die Seite in dieser Sprache öffnet. Stimmeinstellungen — und, nur wenn du es einschaltest, das Gespräch selbst — bleiben ausschließlich in diesem Browser, bis du sie vergessen lässt.',
    fullVersion: 'Die vollständige Fassung, mit dem, was versprochen wird und was nicht:',
  },
  voice: {
    eyebrow: 'Einstellungen',
    title: 'Stimme und Sprache',
    language: 'Sprache',
    languageNote:
      'Für die Oberfläche, die Denkschritte und die Spracheingabe. Antworten kommen in der Sprache, in der du fragst.',
    alwaysSpeak: 'Antworten immer vorlesen',
    alwaysSpeakNote:
      'Jede Antwort laut vorlesen, ob getippt oder gesprochen. Es wird erst etwas abgespielt, wenn du bei diesem Besuch etwas gefragt hast.',
    onDevice: 'Spracherkennung auf dem Gerät',
    onDeviceNotes: {
      server:
        'Dieser Browser hat keine eingebaute Spracherkennung, deshalb wird deine Stimme stattdessen auf dem Server transkribiert.',
      installing: 'Das Sprachmodell wird heruntergeladen…',
      failed: 'Das Sprachmodell wurde nicht fertig heruntergeladen. Versuch es später noch einmal.',
      available: 'Deine Stimme auf diesem Gerät erkennen, sodass das Audio es nie verlässt.',
      downloadable:
        'Chrome lädt einmal ein Sprachmodell herunter und erkennt deine Stimme dann auf diesem Gerät.',
      unknown: 'Prüfe, was dieser Browser kann…',
      unavailable: 'In diesem Browser nicht verfügbar — er nutzt seinen eigenen Sprachdienst.',
    },
    voice: 'Stimme',
    cannotSpeak: 'Dieser Browser kann Antworten nicht laut vorlesen.',
    defaultVoice: ' (Standard)',
    automatic: 'Automatisch',
    hearIt: 'Anhören',
    sample: 'So klinge ich, wenn ich dir antworte.',
    serverNote: 'Nur Standardstimmen von OpenAI — nie die Nachahmung einer echten Person.',
    browserNote:
      'Die eigenen Stimmen deines Geräts. Mit einem OpenAI-Schlüssel werden stattdessen Standardstimmen von OpenAI angeboten.',
    notPersisted:
      'Dieser Browser lässt mich keine Einstellungen speichern, deshalb gelten sie nur, bis du den Tab schließt.',
    unavailable: 'Spracheingabe ist in diesem Browser nicht verfügbar',
    blocked: 'Mikrofon blockiert — erlaube es in den Browsereinstellungen',
    talk: 'Mit Steven sprechen (M)',
  },
  access: {
    prompt: `Diese Kopie von ${brand.name} ist privat. Gib den Zugangscode ein, den du von ihrem Betreiber bekommen hast.`,
    placeholder: 'Zugangscode',
    enter: 'Weiter',
    checking: 'Prüfe…',
    wrong: 'Dieser Zugangscode stimmt nicht.',
    slow: 'Zu viele Versuche. Warte eine Minute und versuch es dann noch einmal.',
    offline: 'Das konnte ich gerade nicht prüfen. Noch einmal versuchen?',
  },
  ui: {
    close: 'Schließen',
    notifications: 'Benachrichtigungen',
  },
  termsPage: {
    title: 'Nutzungsbedingungen, Haftungsausschluss und Datenschutz',
    onThisPage: 'Auf dieser Seite',
    newTab: ' (öffnet in einem neuen Tab)',
    englishOnly:
      'Die Bedingungen gibt es vorerst nur auf Englisch. Im Zweifel gilt der englische Text.',
    updated: (date) =>
      `Zuletzt aktualisiert am ${date}. Verständlich formuliert, keine Rechtsberatung.`,
  },
};
