import React from 'react'
import { useSelector } from 'react-redux';

const Dahboard = () => {

    const {user} = useSelector((state) => state.auth);
    console.log(user);
  return (
    <div>Dahboard</div>
  )
}

export default Dahboard