# Γρήγορη εκκίνηση του CellFence

> Μετάφραση από την κοινότητα. Η αγγλική πηγή είναι το [README του CellFence](../../../README.md).

Το CellFence είναι ένα ντετερμινιστικό εργαλείο ελέγχου αρχιτεκτονικής για αποθετήρια που τροποποιούνται τόσο από ανθρώπους όσο και από coding agents. Ελέγχει την τελική κατάσταση του αποθετηρίου και εντοπίζει αρχιτεκτονικές αποκλίσεις που μπορεί να μη φανούν σε συνηθισμένα tests ή type checks.

Για παράδειγμα, μπορεί να απορρίψει ένα import από την ιδιωτική υλοποίηση ενός άλλου cell, ακόμη κι αν ο κώδικας μεταγλωττίζεται και τα tests περνούν. Ένα cell που εξαρτάται από κάποιο άλλο πρέπει να χρησιμοποιεί το δηλωμένο public entry του δεύτερου.

## Δοκιμή σε εξήντα δευτερόλεπτα

Σε έναν κενό φάκελο:

```bash
npm install --save-dev cellfence
npx cellfence init                              # writes cellfence.manifest.json
mkdir -p src/example
echo 'export const example = 1;' > src/example/public.ts
npx cellfence check
```

Η αναμενόμενη έξοδος είναι:

```text
CellFence check passed.
```
Η εντολή `init` δημιουργεί ένα αρχικό manifest με ένα cell `example` που κατέχει το `src/example/**`. Μετονόμασέ το, πρόσθεσε τα πραγματικά cells του αποθετηρίου σου και ξανατρέξε το `check` μέχρι το fence να περιγράφει σωστά την αρχιτεκτονική σου.

Για μη καταστροφικό automation, το `init --no-scaffold` αρνείται να χρησιμοποιήσει αυτό το κενό starter ως fallback, αντί να γράψει manifest που δείχνει σε ανύπαρκτα αρχεία.

## Δοκιμή σε υπάρχον αποθετήριο

Σε αποθετήριο που έχει ήδη source files:

```bash
npm install --save-dev cellfence
npx cellfence init --no-scaffold
npx cellfence check --format markdown
```

Το `init --no-scaffold` προσπαθεί να συμπεράνει το πραγματικό σχήμα του αποθετηρίου χωρίς να δημιουργήσει placeholder αρχεία. Αν δεν μπορεί να συμπεράνει αξιόπιστο σχήμα, τερματίζει αντί να παρουσιάσει ένα starter manifest σαν ολοκληρωμένη ρύθμιση.

Έλεγξε το `cellfence.manifest.json` που δημιουργήθηκε **πριν** το κάνεις commit. Το manifest που προκύπτει αυτόματα είναι αφετηρία και όχι απόδειξη ότι έχουν αποτυπωθεί όλα τα όρια που θέλεις να επιβάλεις.

Όταν το τοπικό check συμφωνεί με την αρχιτεκτονική που θέλεις, διάλεξε κατάλληλο CI έλεγχο, όπως απλό `check`, `check --changed --base origin/main` ή `baseline check` με ελεγμένο `cellfence.baseline.json`. Για λεπτομέρειες δες τον αγγλικό [οδηγό CI](../../ci.md).

## Περιορισμοί και επόμενα βήματα

Το CellFence βρίσκεται ακόμη σε **pre-release v0.x**, επομένως schemas και CLI flags μπορεί να αλλάζουν μεταξύ minor εκδόσεων. Απαιτεί **Node.js 20 ή νεότερο**.

Το εργαλείο είναι ισχυρότερο στη στατική ανάλυση TypeScript/JavaScript και διαθέτει περιορισμένη, συγκεκριμένη υποστήριξη για Python και επιλεγμένα resource patterns. Δεν μπορεί να αποδείξει κάθε δυναμική συμπεριφορά ή να επιλύσει κάθε computed import.

Το CellFence **δεν είναι runtime sandbox ή σύστημα δικαιωμάτων για tool calls**. Επίσης δεν εγγυάται ότι ο παραγόμενος κώδικας είναι λειτουργικά σωστός. Συμπληρώνει — δεν αντικαθιστά — tests, linting, type checking, protected branches και code review.

Δες την πλήρη αγγλική λίστα [τρεχόντων περιορισμών](../../limitations.md) και τον [οδηγό CI](../../ci.md) πριν το χρησιμοποιήσεις ως required check σε πραγματικό έργο.
