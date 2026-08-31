/**
 * The small line at the foot of every page with a canvas on it, pointing at
 * the comfort toggles.
 *
 * It is a component rather than three copies of the same JSX because the
 * sentence has a real `<Link>` in the middle of it, and a sentence assembled
 * from more than one node is the one shape this extraction can quietly break:
 * JSX drops whitespace-only lines, so the space before the link has to travel
 * inside `finePrintLead`. One copy is one place for that to be right, and one
 * seam for a test to hold it.
 */
import { Link } from 'react-router';
import { playCopy } from '../copy/play';

export function FinePrint() {
  return (
    <p className="fine-print">
      {playCopy.finePrintLead}
      <Link to="/settings">{playCopy.finePrintLink}</Link>
      {playCopy.finePrintTail}
    </p>
  );
}
