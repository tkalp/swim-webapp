// components/swimmers/SwimmerProfileCard.tsx
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';

type Swimmer = {
  id?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  sex?: string;
};

type SwimmerProfileCardProps = {
  swimmer: Swimmer;
};

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

export default function SwimmerProfileCard({ swimmer }: SwimmerProfileCardProps) {
  const fullName = `${swimmer.first_name || ''} ${swimmer.last_name || ''}`.trim();
  const age = swimmer.date_of_birth ? calculateAge(swimmer.date_of_birth) : null;

  return (
    <div className="bg-gradient-to-br from-background-elevated/90 to-background-secondary/70 backdrop-blur-md border border-border rounded-xl p-5 shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all duration-300">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Avatar 
          firstName={swimmer.first_name} 
          lastName={swimmer.last_name}
          size="md"
        />

        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent drop-shadow-sm">
            {fullName}
          </h1>
          
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            {age !== null && (
              <Badge variant="default">
                Age: {age}
              </Badge>
            )}
            {swimmer.sex && (
              <Badge variant="primary">
                {swimmer.sex}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
