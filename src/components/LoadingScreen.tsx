import React from 'react';
import { OR } from '../constants';

const LoadingScreen: React.FC = () => (
  <div style={{textAlign:"center",paddingTop:80}}>
    <div style={{fontSize:60,marginBottom:16}}>📊</div>
    <p style={{color:OR,fontWeight:800,fontSize:18}}>Laden...</p>
  </div>
);

export default LoadingScreen;
