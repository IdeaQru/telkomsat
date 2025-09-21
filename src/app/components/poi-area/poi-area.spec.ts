import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PoiArea } from './poi-area';

describe('PoiArea', () => {
  let component: PoiArea;
  let fixture: ComponentFixture<PoiArea>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoiArea]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PoiArea);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
