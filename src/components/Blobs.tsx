import React from 'react';
import { OR, ORL, ORPL } from '../constants';

const Blobs: React.FC = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}}>
    <div style={{position:"absolute",top:-100,right:-100,width:320,height:320,borderRadius:"50%",background:`radial-gradient(circle,${OR}28,transparent 70%)`}}/>
    <div style={{position:"absolute",bottom:-80,left:-80,width:260,height:260,borderRadius:"50%",background:`radial-gradient(circle,${ORL}22,transparent 70%)`}}/>
    <div style={{position:"absolute",top:"35%",right:-50,width:180,height:180,borderRadius:"50%",background:`radial-gradient(circle,${ORPL},transparent 70%)`}}/>
  </div>
);

export default Blobs;
