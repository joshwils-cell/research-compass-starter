import {useEffect,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
export function Modal({title,close,children}:{title:string;close:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.showModal();return()=>previous?.focus();},[]);
  return createPortal(<dialog ref={ref} onCancel={close} aria-label={title}><header><h2>{title}</h2><button onClick={close} aria-label="Close dialog">Close</button></header>{children}</dialog>,document.body);
}
