const fs = require('fs');
let code = fs.readFileSync('src/components/Arena/StudyCard.tsx', 'utf8');

code = code.replace(/import RatingButtons from '\.\.\/Learning\/RatingButtons';/, '');
code = code.replace(/import type \{ ReviewRating \} from '\.\.\/\.\.\/types\/learning';/, "import type { StudyRating } from '../../types/dictionary';");
code = code.replace(/onRate: \(rating: ReviewRating\) => void;/, "onRate: (rating: StudyRating) => void;");
code = code.replace(/import \{ ChevronRight, Minus, AlertCircle, ChevronLeft, Flag \} from 'lucide-react';/, "import { ChevronRight, AlertCircle, ChevronLeft, Flag } from 'lucide-react';");

const ratingButtonsMock = `
const RatingButtons: React.FC<{ onRate: (rating: StudyRating) => void; disabled?: boolean }> = ({ onRate, disabled }) => (
    <div className="flex gap-2 justify-center mt-4">
        <button disabled={disabled} onClick={() => onRate('again')} className="p-2 bg-red-100">Again</button>
        <button disabled={disabled} onClick={() => onRate('hard')} className="p-2 bg-orange-100">Hard</button>
        <button disabled={disabled} onClick={() => onRate('good')} className="p-2 bg-green-100">Good</button>
        <button disabled={disabled} onClick={() => onRate('easy')} className="p-2 bg-blue-100">Easy</button>
    </div>
);
`;

code = code.replace('interface StudyCardProps {', ratingButtonsMock + '\ninterface StudyCardProps {');
fs.writeFileSync('src/components/Arena/StudyCard.tsx', code);
console.log('Fixed StudyCard');
