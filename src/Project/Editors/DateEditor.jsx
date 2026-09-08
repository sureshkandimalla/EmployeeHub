import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { DatePicker } from 'antd';
import moment from 'moment';

const DateEditor = forwardRef((props, ref) => {
  const initial = props.value ? moment(props.value) : null;
  const [date, setDate] = useState(initial);

  useImperativeHandle(ref, () => ({
    // called by AG Grid to get the final value
    getValue() {
      return date ? date.format('YYYY-MM-DD') : '';
    },
    // tell grid we are finished
    isPopup() {
      return false;
    }
  }));

  useEffect(() => {
    setDate(initial);
  }, [props.value]);

  return (
    <DatePicker
      value={date}
      onChange={(d) => setDate(d)}
      format={"MM/DD/YYYY"}
      style={{ width: '100%' }}
    />
  );
});

export default DateEditor;
