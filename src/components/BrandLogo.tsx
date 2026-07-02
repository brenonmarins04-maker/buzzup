import buzzupLogo from "@/assets/buzzup-logo.png";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
};

export default function BrandLogo({
  className,
  markClassName,
  textClassName,
  showText = true,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={buzzupLogo}
        alt=""
        aria-hidden="true"
        className={cn("h-9 w-9 object-contain shrink-0", markClassName)}
      />
      {showText && (
        <span className={cn("font-extrabold tracking-tight", textClassName)}>
          BuzzUp
        </span>
      )}
    </span>
  );
}
