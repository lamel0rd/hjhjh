import React from 'react'

export const Card = ({children}) => <div className="card">{children}</div>
export const CardHeader = ({children}) => <div style={{marginBottom:8}}>{children}</div>
export const CardContent = ({children, className}) => <div className={className}>{children}</div>
export const CardFooter = ({children}) => <div className="footer">{children}</div>

export const Button = ({children, variant, ...props}) => {
  const cls = ['btn', variant==='secondary'?'secondary':'', variant==='outline'?'outline':''].join(' ')
  return <button className={cls} {...props}>{children}</button>
}
export const Input = (props) => <input className="input" {...props}/>
export const Textarea = (props) => <textarea className="textarea" rows={3} {...props}/>
export const Label = ({children, className}) => <label className={['label', className||''].join(' ')}>{children}</label>
export const Badge = ({children}) => <span className="badge">{children}</span>

export const Tabs = ({value, onValueChange, children}) => <div>{children}</div>
export const TabsList = ({children}) => <div className="row">{children}</div>
export const TabsTrigger = ({value, children, onClick}) => <button className="btn outline" onClick={onClick}>{children}</button>
export const TabsContent = ({children}) => <div>{children}</div>

export const Alert = ({children, className}) => <div className={['alert', className||''].join(' ')}>{children}</div>
export const AlertTitle = ({children}) => <div style={{fontWeight:600, marginBottom:6}}>{children}</div>
export const AlertDescription = ({children}) => <div style={{fontSize:13, opacity:.9}}>{children}</div>
