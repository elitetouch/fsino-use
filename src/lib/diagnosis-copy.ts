/**
 * Turns the model's vocabulary into a farmer's.
 *
 * The service speaks in machine-learning terms — "Failed class
 * confidence threshold", "High entropy (uncertain)", "Energy OOD
 * triggered". Those are meaningful to whoever tuned the thresholds and
 * meaningless to a farmer standing in a pen at six in the morning.
 *
 * Worse, they are a DEAD END. A refusal that does not say what to do
 * next just teaches people the tool does not work, and they stop using
 * it. Every refusal here therefore comes with a concrete, physical
 * instruction — move closer, wipe the lens, step into the light.
 */

export type RefusalCopy = {
  title: string;
  body: string;
  /** What to physically do differently. Shown as a checklist. */
  fixes: string[];
};

/**
 * The model's `reason` strings, mapped to plain language.
 *
 * Matched loosely on substrings because these come from a separate
 * codebase; an exact-match table would silently fall through to the
 * generic case the first time someone rewords a message in Python.
 */
export function refusalCopy(reason: string | null): RefusalCopy {
  const r = (reason ?? '').toLowerCase();

  if (r.includes('human')) {
    return {
      title: "There's a person in the photo",
      body: 'The camera picked up a face, so the photo was not checked. Photograph only the droppings.',
      fixes: [
        'Point the camera down at the litter',
        'Keep hands, feet and faces out of the frame',
      ],
    };
  }

  if (r.includes('low-texture') || r.includes('blur')) {
    return {
      title: 'The photo is too blurry or too flat',
      body: 'There was not enough detail to examine. This usually means the camera moved, or it was too close to focus.',
      fixes: [
        'Hold the phone still and let it focus before tapping',
        'Stay about an arm’s length away, not closer',
        'Wipe the camera lens — droppings dust it quickly',
      ],
    };
  }

  // Matches the backend's energy and feature-space guards, whose reason
  // reads "Image does not resemble poultry droppings". Kept loose on
  // purpose — these strings come from a separate Python codebase, and an
  // exact-match table silently falls through to the generic case the
  // first time someone rewords one.
  if (
    r.includes('do not match') ||
    r.includes('not poultry') ||
    r.includes('resemble') ||
    r.includes('poultry droppings')
  ) {
    return {
      title: "This doesn't look like droppings",
      body: 'The photo does not resemble the chicken droppings this tool was trained on, so no guess was made.',
      fixes: [
        // NOT "fill the frame" — that advice was measured to push
        // genuine droppings out of the model's distribution. It learned
        // small droppings within a wider field of ground.
        'Stand over the droppings and shoot downwards',
        'Include some ground around them rather than filling the frame',
        'Avoid photographing feeders, birds or bare floor',
      ],
    };
  }

  // Confidence threshold, entropy and energy all mean the same thing to
  // a farmer: the model looked, and was not sure enough to say.
  return {
    title: 'Not clear enough to be sure',
    body: 'The photo was examined but the result was not confident enough to report. Showing you a guess here could cost you a flock, so it is withheld deliberately.',
    fixes: [
      'Shoot from standing height, with some ground visible around the droppings',
      'Take it in daylight, or use the torch — avoid deep shadow',
      'Photograph a single fresh dropping rather than a mixed patch',
    ],
  };
}

/**
 * Confidence as words, not just a number.
 *
 * "94.21%" invites false precision — the difference between 94% and 96%
 * is not something a farmer should act on differently, and a decimal
 * implies a certainty the model does not have. The band is what should
 * drive the decision.
 */
export function confidenceBand(confidence: number | null): {
  label: string;
  tone: 'strong' | 'moderate';
  note: string;
} {
  const c = confidence ?? 0;

  if (c >= 90) {
    return {
      label: 'Very confident',
      tone: 'strong',
      note: 'This closely matches known cases.',
    };
  }

  return {
    label: 'Fairly confident',
    tone: 'moderate',
    note: 'Worth acting on, but confirm with a vet if you can.',
  };
}

/**
 * Per-disease urgency and framing.
 *
 * The four classes are NOT equivalent in what they demand of a farmer,
 * and presenting them identically would be the single most dangerous
 * thing this screen could do.
 *
 * Newcastle disease in particular has no treatment, spreads fast, and
 * is notifiable in Nigeria. Showing it in the same calm blue card as a
 * routine coccidiosis result — with a "Treatment" heading implying one
 * exists — would actively mislead someone into dosing birds instead of
 * isolating them and calling a vet.
 */
export type DiseaseFraming = {
  urgency: 'critical' | 'high' | 'routine' | 'none';
  headline: string;
  /** Said before any treatment detail, when the ordering matters. */
  leadWith?: string;
};

export function diseaseFraming(disease: string | null): DiseaseFraming {
  const d = (disease ?? '').toLowerCase();

  if (d.includes('castle')) {
    return {
      urgency: 'critical',
      headline: 'Act today',
      leadWith:
        'Newcastle disease spreads very fast and has no cure once birds are infected. Separate affected birds now and contact a vet or your local veterinary office — it is a reportable disease.',
    };
  }

  if (d.includes('salmonella')) {
    return {
      urgency: 'high',
      headline: 'Act today',
      leadWith:
        'Salmonella can pass to people through eggs and meat. Handle birds with care, wash hands thoroughly, and speak to a vet before treating.',
    };
  }

  if (d.includes('coccidiosis')) {
    return {
      urgency: 'high',
      headline: 'Treat promptly',
      leadWith:
        'Coccidiosis is treatable and responds well when caught early, but it spreads through wet litter.',
    };
  }

  if (d.includes('healthy')) {
    return { urgency: 'none', headline: 'No action needed' };
  }

  return { urgency: 'routine', headline: 'Review the guidance' };
}
