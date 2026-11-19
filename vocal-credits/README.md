# Vocal pronunciation data

The offline English lookup derives from [CMUdict](https://github.com/cmusphinx/cmudict), revision `74790861f652b15e4ac49015a90074ad62a27690`. Copyright and redistribution terms are reproduced in [CMUdict-LICENSE.txt](CMUdict-LICENSE.txt), the generated module and the root third-party notices.

`prepare-vocal-lexicon.py` verifies the pinned dictionary's SHA-256, takes the first standard alphabetic spelling/pronunciation, removes vowel stress digits and retains entries of up to 32 phones. The result has 124,082 spellings. The manifest records the source revision and original hash. Normal builds use the included generated data without network access.

This data describes pronunciation, not a recorded singer, trained model or voice clone. The synthetic vocal renderer is original Studio code with artist-tuned resonances. Background on the separation of voice excitation and vowel resonances: Julius O. Smith III, [Formant Synthesis Models](https://dsprelated.com/freebooks/pasp/Formant_Synthesis_Models.html), *Physical Audio Signal Processing*. No code or tables were copied from that book.
