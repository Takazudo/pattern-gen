import './home-page.css';

interface HomePageProps {
  onSelectPattern: (patternType: string, slug: string, colorSchemeIndex: number) => void;
}

export function HomePage({ onSelectPattern }: HomePageProps) {
  return (
    <div className="home-page">
      <p>Loading patterns...</p>
    </div>
  );
}
