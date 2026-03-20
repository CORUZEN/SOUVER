import coreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const eslintConfig = [
  ...coreWebVitals,
  ...nextTypescript,
  {
    settings: {
      react: { version: '19' },
    },
    rules: {
      // Valid async data-fetching pattern; rule has false positives for useCallback in useEffect
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default eslintConfig
