import { TestBed } from '@angular/core/testing';

import { AtonService } from './aton.service';

describe('AtonService', () => {
  let service: AtonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AtonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
