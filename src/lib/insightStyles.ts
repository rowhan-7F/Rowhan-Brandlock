import { CSSProperties } from "react";

export const getInsightTextClass = (style: string): string => {
  const base = "uppercase tracking-[0.25em] text-[3.6cqw] font-black inline-block";
  switch (style) {
    case 'underline': return `${base}`;
    case 'boxed': return `${base} px-[3cqw] py-[1.2cqw] rounded-md`;
    case 'pill_rounded': return `${base} px-[4cqw] py-[1.4cqw] rounded-full`;
    case 'pill_squared': return `${base} px-[3cqw] py-[1.2cqw]`;
    default: return `${base} opacity-60`;
  }
};

export const getInsightInlineStyle = (
  style: string,
  mainColor: string,
  bgColor: string,
  defaultColor: string
): CSSProperties => {
  switch (style) {
    case 'underline':
      return {
        color: defaultColor,
        borderBottom: `0.5cqw solid ${mainColor}`,
        paddingBottom: '0.5cqw'
      };
    case 'boxed':
      return {
        color: defaultColor,
        border: `0.4cqw solid ${mainColor}`
      };
    case 'pill_rounded':
    case 'pill_squared':
      return { backgroundColor: mainColor, color: bgColor };
    default:
      return { color: defaultColor };
  }
};