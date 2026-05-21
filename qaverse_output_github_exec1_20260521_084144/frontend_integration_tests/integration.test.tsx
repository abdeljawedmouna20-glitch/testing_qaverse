import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';

// Navigation Bar with generic routes
const NavBar = () => (
  <nav>
    <Link to="/">Home</Link>
    <Link to="/about">About</Link>
    <Link to="/data-flow">Data Flow</Link>
    <Link to="/contact">Contact</Link>
  </nav>
);

// Home page with API data fetching
const HomePage = () => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch('/api/items')
      .then((r) => r.json())
      .then((data) => {
        if (data?.items) setItems(data.items);
      });
  }, []);
  return (
    <div>
      <h1>Home</h1>
      <ul data-testid="items-list">
        {items.map((it) => (
          <li key={it}>{it}</li>
        ))}
      </ul>
    </div>
  );
};

// About page
const AboutPage = () => (
  <div>
    <h1>About</h1>
    <p>About page content</p>
  </div>
);

// Data flow components: Parent passes data to Child; Child can trigger update via callback
const DataChild = ({ text, onUppercase }) => (
  <div>
    <span data-testid="child-text">{text}</span>
    <button onClick={onUppercase}>Make uppercase</button>
  </div>
);

const DataParent = () => {
  const [text, setText] = useState('Hello');
  return (
    <div>
      <DataChild text={text} onUppercase={() => setText((t) => t.toUpperCase())} />
    </div>
  );
};

const DataParentWrapper = () => <DataParent />;

// Contact form with basic validation and submission
const ContactForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Name is required');
      return;
    }
    if (!email) {
      setError('Email is required');
      return;
    }
    setError('');
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    setSubmitted(true);
  };

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" data-testid="email-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit">Submit</button>
      {error && <div role="alert">{error}</div>}
      {submitted && <div>Submitted</div>}
    </form>
  );
};

// App shell with in-test routing to simulate actual app routes
const AppShell = ({ initialRoute = '/' }) => (
  <MemoryRouter initialEntries={[initialRoute]}>
    <NavBar />
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/data-flow" element={<DataParentWrapper />} />
      <Route path="/contact" element={<ContactForm />} />
    </Routes>
  </MemoryRouter>
);

// Tests: generic navigation, component interaction, API integration, and form submission
describe('Generic React frontend integration tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('navigates between Home and About routes', () => {
    render(<AppShell initialRoute="/" />);
    // Initial route shows Home
    expect(screen.getByRole('heading', { name: /Home/i })).toBeInTheDocument();

    // Navigate to About
    const aboutLink = screen.getByText('About');
    fireEvent.click(aboutLink);
    expect(screen.getByRole('heading', { name: /About/i })).toBeInTheDocument();

    // Navigate back to Home
    const homeLink = screen.getByText('Home');
    fireEvent.click(homeLink);
    expect(screen.getByRole('heading', { name: /Home/i })).toBeInTheDocument();
  });

  test('data flow updates between DataParent and DataChild', () => {
    render(<AppShell initialRoute="/data-flow" />);
    const textEl = screen.getByTestId('child-text');
    expect(textEl).toHaveTextContent('Hello');

    const button = screen.getByText('Make uppercase');
    fireEvent.click(button);

    // After update, text should be uppercase
    expect(textEl).toHaveTextContent('HELLO');
  });

  test('fetches API data and renders items', async () => {
    const mockResponse = { items: ['Alpha', 'Beta'] };
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })
    );
    render(<AppShell initialRoute="/" />);

    const alpha = await screen.findByText('Alpha');
    const beta = await screen.findByText('Beta');
    expect(alpha).toBeInTheDocument();
    expect(beta).toBeInTheDocument();
  });

  test('form submission and validations', async () => {
    const mockFetchSubmit = jest
      .spyOn(global, 'fetch')
      .mockImplementation((url, options) =>
        Promise.resolve({ ok: true })
      );
    render(<AppShell initialRoute="/contact" />);

    // Trigger validation with empty fields
    fireEvent.click(screen.getByText('Submit'));
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');

    // Fill fields and submit
    const nameInput = screen.getByTestId('name-input');
    const emailInput = screen.getByTestId('email-input');
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(mockFetchSubmit).toHaveBeenCalledWith('/api/submit', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' }),
    }));

    // Expect submission acknowledgment
    const submitted = await screen.findByText('Submitted');
    expect(submitted).toBeInTheDocument();
  });
});