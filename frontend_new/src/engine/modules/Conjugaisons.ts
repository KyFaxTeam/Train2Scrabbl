/**
 * Formes conjuguees d'un verbe, verifiees dans le lexique.
 *
 * Les regles ci-dessous PROPOSENT des formes, le lexique TRANCHE : une forme
 * n'est rendue que si l'ODS la contient. On peut donc proposer large (radical
 * double, Y -> I, G -> GE) sans risque d'inventer un mot - au pire on rate une
 * forme irreguliere (FAIRE -> FERONT), jamais on n'en invente une.
 *
 * Au Scrabble les accents et la cedille disparaissent : LEVER -> LEVE (leve),
 * PLACER -> PLACONS (placons). La plupart des alternances de radical s'effacent
 * d'elles-memes ; restent le doublement (JETER -> JETTE), Y -> I (PAYER ->
 * PAIERA) et le E d'appui des verbes en -GER (MANGER -> MANGEAIT).
 */

const TERMINAISONS_ER = [
    // present, imparfait, passe simple
    'E', 'ES', 'ENT', 'ONS', 'EZ',
    'AIS', 'AIT', 'AIENT', 'IONS', 'IEZ',
    'AI', 'AS', 'A', 'AMES', 'ATES', 'ERENT',
    // futur, conditionnel
    'ERAI', 'ERAS', 'ERA', 'ERONS', 'EREZ', 'ERONT',
    'ERAIS', 'ERAIT', 'ERIONS', 'ERIEZ', 'ERAIENT',
    // subjonctif imparfait, participes
    'ASSE', 'ASSES', 'AT', 'ASSIONS', 'ASSIEZ', 'ASSENT',
    'ANT', 'EE', 'EES',
];

/** Deuxieme groupe (FINIR) - et la plupart des formes en -I- du troisieme. */
const TERMINAISONS_IR = [
    'IS', 'IT', 'ISSONS', 'ISSEZ', 'ISSENT',
    'ISSAIS', 'ISSAIT', 'ISSIONS', 'ISSIEZ', 'ISSAIENT',
    'IMES', 'ITES', 'IRENT',
    'IRAI', 'IRAS', 'IRA', 'IRONS', 'IREZ', 'IRONT',
    'IRAIS', 'IRAIT', 'IRIONS', 'IRIEZ', 'IRAIENT',
    'ISSE', 'ISSES', 'ISSANT', 'IE', 'IES',
    // troisieme groupe sans -ISS- (PARTIR -> PARTONS, PARTAIT)
    'ONS', 'EZ', 'ENT', 'AIS', 'AIT', 'AIENT', 'IONS', 'IEZ', 'ANT',
];

/** Verbes en -RE (RENDRE, PONDRE, MEDIRE...). */
const TERMINAISONS_RE = [
    'S', 'ONS', 'EZ', 'ENT',
    'AIS', 'AIT', 'AIENT', 'IONS', 'IEZ',
    'IS', 'IT', 'IMES', 'ITES', 'IRENT',
    'RAI', 'RAS', 'RA', 'RONS', 'REZ', 'RONT',
    'RAIS', 'RAIT', 'RIONS', 'RIEZ', 'RAIENT',
    'E', 'ES', 'ISSE', 'ISSES', 'ANT',
    'U', 'UE', 'US', 'UES', 'ISE', 'ISES', 'ITE', 'ITES',
];

function radicauxEr(radical: string): string[] {
    const r = [radical];
    const derniere = radical[radical.length - 1];
    // JETER -> JETTE, APPELER -> APPELLE
    if ((derniere === 'L' || derniere === 'T') && radical.endsWith('E' + derniere)) r.push(radical + derniere);
    // PAYER -> PAIE, NETTOYER -> NETTOIE
    if (derniere === 'Y') r.push(radical.slice(0, -1) + 'I');
    return r;
}

function candidats(verbe: string): Set<string> {
    const out = new Set<string>();
    const fin2 = verbe.slice(-2);

    if (fin2 === 'ER') {
        const radical = verbe.slice(0, -2);
        for (const rad of radicauxEr(radical)) {
            for (const t of TERMINAISONS_ER) {
                // MANGER -> MANGEAIT, MANGEONS : E d'appui devant A et O
                const appui = rad.endsWith('G') && (t[0] === 'A' || t[0] === 'O') ? 'E' : '';
                out.add(rad + appui + t);
            }
        }
    } else if (fin2 === 'IR') {
        const radical = verbe.slice(0, -2);
        for (const t of TERMINAISONS_IR) out.add(radical + t);
    } else if (fin2 === 'RE') {
        const radical = verbe.slice(0, -2);
        for (const t of TERMINAISONS_RE) out.add(radical + t);
        // MEDIRE, NAITRE : le radical court perd aussi sa voyelle finale
        // (CONDUIRE -> CONDUIS : radical CONDUI + S). Deja couvert ci-dessus.
    }

    out.delete(verbe);
    return out;
}

/**
 * Formes conjuguees de `verbe` presentes dans le lexique, a la longueur voulue.
 * L'infinitif lui-meme est exclu : c'est la conjugaison qu'on fait travailler.
 */
export function formesConjuguees(
    verbe: string,
    estUnMot: (mot: string) => boolean,
    longueur = 7
): string[] {
    const formes: string[] = [];
    for (const forme of candidats(verbe)) {
        if (forme.length === longueur && estUnMot(forme)) formes.push(forme);
    }
    return formes.sort();
}
