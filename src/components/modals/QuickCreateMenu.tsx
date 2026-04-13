import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckSquare, Megaphone, FileText } from "lucide-react";

type Props = {
  children: React.ReactNode;
  onCreateTask: () => void;
  onCreatePost: () => void;
  onCreateItem: () => void;
};

export default function QuickCreateMenu({ children, onCreateTask, onCreatePost, onCreateItem }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onCreateTask}>
          <CheckSquare className="h-4 w-4 mr-2" /> Nova Tarefa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreatePost}>
          <Megaphone className="h-4 w-4 mr-2" /> Nova Publicação
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCreateItem}>
          <FileText className="h-4 w-4 mr-2" /> Novo Item
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
