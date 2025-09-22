import css from "./Button.module.css";

type ButtonProps = {
  variant: "outline" | "orange" | "green"; 
  type?: "button" | "submit" | "reset";
  text?: string;
  onClick?: () => void; 
  disabled?: boolean; 
  className?: string; 
};

export const Button: React.FC<ButtonProps> = ({
  variant,
  type = "button",
  onClick,
  disabled = false,
  className,
  text,
}) => {
  const buttonClass = `${css.button} ${css[variant]} ${className || ""}`.trim();

  return (
    <button
      type={type}
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
    >
      {text}
    </button>
  );
};
