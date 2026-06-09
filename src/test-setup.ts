import '@testing-library/jest-dom'
import { beforeEach } from 'vitest'

beforeEach(() => typeof localStorage !== 'undefined' && localStorage.clear())
