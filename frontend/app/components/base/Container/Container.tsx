import { rc } from "@/app/utils/rc";

import css from "./Container.module.css";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export const Container: React.FC<ContainerProps> = ({ children, className }) => {
  return <div className={rc([css.box, className])}>{children}</div>;
};
