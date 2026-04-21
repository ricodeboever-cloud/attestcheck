import React from 'react';
import { OR } from '../constants';

import SmileyIcon from './SmileyIcon';

const LoadingScreen: React.FC = () => (
  <div style={{textAlign:"center",paddingTop:80}}>
    <div style={{marginBottom:16}}>
      <SmileyIcon size={60} />
    </div>
    <p style={{color:OR,fontWeight:800,fontSize:18}}>Laden...</p>
  </div>
);

export default LoadingScreen;
