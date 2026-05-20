import React, { useState, useEffect } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';

describe('Frontend integration tests for React app', () => {
  afterEach(() => {
    cleanup();
    if (global.fetch && typeof global.fetch.mockClear === 'function') {
      global.fetch.mockClear();
    }
  });

  test('navigation between generic routes (Home, About, Contact)', async () => {
    const Home = () => <div>Home Page</div>;
    const About = () => <div>About Page</div>;
    const Contact = () => <div>Contact Page</div>;

    const NavApp = () => (
      <MemoryRouter initialEntries={['/']}>
        <nav>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </MemoryRouter>
    );

    render(<NavApp />);

    // Initial route should render Home
    expect(screen.getByText('Home Page')).toBeInTheDocument();

    // Navigate to About
    userEvent.click(screen.getByText('About'));
    await waitFor(() => expect(screen.getByText('About Page')).toBeInTheDocument());

    // Navigate to Home
    userEvent.click(screen.getByText('Home'));
    await waitFor(() => expect(screen.getByText('Home Page')).toBeInTheDocument());

    // Navigate to Contact
    userEvent.click(screen.getByText('Contact'));
    await waitFor(() => expect(screen.getByText('Contact Page')).toBeInTheDocument());
  });

  test('data flow and interactions between parent and child components', () => {
    // Child component that calls back to parent on change
    const Child = ({ value, onChange }) => (
      <div>
        <input
          aria-label="child-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>Child value: {value}</span>
      </div>
    );

    // Parent holds the state and passes it to Child
    const Parent = () => {
      const [val, setVal] = useState('initial');
      return (
        <div>
          <Child value={val} onChange={setVal} />
          <div>Parent value: {val}</div>
        </div>
      );
    };

    render(<Parent />);

    // Initial render checks
    expect(screen.getByText('Parent value: initial')).toBeInTheDocument();
    expect(screen.getByText('Child value: initial')).toBeInTheDocument();

    // Type into the child input and ensure data flows back to parent
    const input = screen.getByLabelText('child-input');
    userEvent.type(input, 'abc');
    // Expect the updates to propagate to both parent and child display
    expect(screen.getByText('Parent value: abc')).toBeInTheDocument();
    expect(screen.getByText('Child value: abc')).toBeInTheDocument();
  });

  test('API integration with mocked fetch calls', async () => {
    // Simple component that fetches data on mount and renders items
    const ApiList = () => {
      const [items, setItems] = useState([]);
      useEffect(() => {
        let mounted = true;
        fetch('/api/items')
          .then((res) => res.json())
          .then((data) => {
            if (mounted) setItems(data);
          })
          .catch(() => {});
        return () => {
          mounted = false;
        };
      }, []);
      return (
        <ul>
          {items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      );
    };

    // Mock fetch response
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(['apple', 'banana']),
      })
    );

    render(<ApiList />);

    // Ensure fetch was called with the correct endpoint
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/items');
    });

    // Ensure items are rendered
    await waitFor(() => expect(screen.getByText('apple')).toBeInTheDocument());
    expect(screen.getByText('banana')).toBeInTheDocument();
  });

  test('form submission handling and validations', async () => {
    // Simple form component
    const SimpleForm = ({ onSubmit }) => {
      const [value, setValue] = useState('');
      const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(value);
      };
      return (
        <form onSubmit={handleSubmit}>
          <input
            aria-label="form-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit">Submit</button>
        </form>
      );
    };

    const mockOnSubmit = jest.fn();
    render(<SimpleForm onSubmit={mockOnSubmit} />);

    // Enter value and submit
    userEvent.type(screen.getByLabelText('form-input'), 'test value');
    userEvent.click(screen.getByText('Submit'));

    // Ensure onSubmit was called with the entered value
    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledWith('test value'));
  });
});